/**
 * ============================================================
 * SCORPION X – WEBSOCKET.JS
 * WebSocket server for real-time chat
 * ============================================================
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== CONFIGURATION ====================
const JWT_SECRET = process.env.JWT_SECRET || 'scorpion_x_secret_key_change_me';
const WS_PORT = process.env.WS_PORT || 3001;
const WS_PATH = process.env.WS_PATH || '/ws';

// ==================== DATA HELPERS ====================
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');

const readJSON = (file) => {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify([]));
            return [];
        }
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (error) {
        console.error(`Error reading ${file}:`, error);
        return [];
    }
};

const writeJSON = (file, data) => {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error writing ${file}:`, error);
    }
};

// ==================== CREATE SERVER ====================
// Use the HTTP server from server.js if available, otherwise create standalone
let httpServer;

// Check if we're running standalone or with server.js
if (process.env.WS_STANDALONE === 'true') {
    httpServer = createServer();
    httpServer.listen(WS_PORT, () => {
        console.log(`🔌 WebSocket server running on port ${WS_PORT}`);
    });
} else {
    // Will be attached to the main server
    httpServer = null;
}

// ==================== SOCKET.IO SERVER ====================
const io = new Server(httpServer || 3001, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
        credentials: true
    },
    path: WS_PATH,
    pingInterval: 30000,
    pingTimeout: 10000,
});

// ==================== STATE ====================
const onlineUsers = new Map(); // userId -> socketId
const userSockets = new Map(); // socketId -> userId
const typingUsers = new Map(); // chatId -> { userId, timer }

// ==================== AUTH MIDDLEWARE ====================
io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
        return next(new Error('Authentication required'));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.id;
        socket.userData = decoded;
        next();
    } catch (error) {
        console.error('WebSocket auth error:', error);
        return next(new Error('Invalid token'));
    }
});

// ==================== CONNECTION HANDLER ====================
io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`🔌 User ${userId} connected`);

    // Store socket
    onlineUsers.set(userId, socket.id);
    userSockets.set(socket.id, userId);

    // Update user online status
    updateUserStatus(userId, true);

    // ==================== AUTHENTICATE ====================
    socket.on('authenticate', (data) => {
        const userData = getUserData(userId);
        socket.emit('authenticated', {
            success: true,
            user: {
                id: userId,
                username: userData?.username || 'User',
                email: userData?.email || ''
            }
        });

        // Send online users list
        const onlineList = Array.from(onlineUsers.keys());
        socket.emit('users:online', { users: onlineList });
    });

    // ==================== MESSAGE HANDLING ====================
    socket.on('message:send', async (data) => {
        const { chatId, chatType, text, mediaUrl } = data;

        if (!chatId || !chatType) {
            socket.emit('message:error', { message: 'Chat ID and type required' });
            return;
        }

        if (!text && !mediaUrl) {
            socket.emit('message:error', { message: 'No content' });
            return;
        }

        // Save message
        const messages = readJSON(MESSAGES_FILE);
        const newMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            chatId,
            chatType,
            senderId: userId,
            text: text || '',
            mediaUrl: mediaUrl || null,
            mediaType: null,
            status: 'delivered',
            timestamp: new Date().toISOString()
        };

        messages.push(newMessage);
        writeJSON(MESSAGES_FILE, messages);

        // Get sender name
        const userData = getUserData(userId);
        const senderName = userData?.username || 'User';

        const messageData = {
            ...newMessage,
            senderName
        };

        // Emit to all users in the chat
        io.emit('message:new', messageData);

        // If it's a group chat, emit to group members
        if (chatType === 'group') {
            const groups = readJSON(GROUPS_FILE);
            const group = groups.find(g => g.id === chatId);
            if (group && group.members) {
                group.members.forEach(memberId => {
                    const memberSocketId = onlineUsers.get(memberId);
                    if (memberSocketId) {
                        io.to(memberSocketId).emit('message:new', messageData);
                    }
                });
            }
        }

        socket.emit('message:sent', { success: true, message: newMessage });
    });

    // ==================== MESSAGE READ ====================
    socket.on('message:read', (data) => {
        const { messageId } = data;
        if (!messageId) return;

        const messages = readJSON(MESSAGES_FILE);
        const msg = messages.find(m => m.id === messageId);
        if (msg) {
            msg.status = 'read';
            writeJSON(MESSAGES_FILE, messages);

            // Notify sender
            const senderSocketId = onlineUsers.get(msg.senderId);
            if (senderSocketId) {
                io.to(senderSocketId).emit('message:read', { messageId, readerId: userId });
            }
        }
    });

    // ==================== TYPING INDICATORS ====================
    socket.on('typing:start', (data) => {
        const { chatId } = data;
        if (!chatId) return;

        const userData = getUserData(userId);
        const userName = userData?.username || 'User';

        // Broadcast to other users in the chat
        socket.broadcast.emit('typing:start', {
            chatId,
            userId,
            userName
        });

        // Set timeout to auto-stop typing after 3 seconds
        const existingTimer = typingUsers.get(`${chatId}_${userId}`);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
            socket.broadcast.emit('typing:stop', { chatId, userId });
            typingUsers.delete(`${chatId}_${userId}`);
        }, 3000);

        typingUsers.set(`${chatId}_${userId}`, timer);
    });

    socket.on('typing:stop', (data) => {
        const { chatId } = data;
        if (!chatId) return;

        const timer = typingUsers.get(`${chatId}_${userId}`);
        if (timer) {
            clearTimeout(timer);
            typingUsers.delete(`${chatId}_${userId}`);
        }

        socket.broadcast.emit('typing:stop', { chatId, userId });
    });

    // ==================== GROUP HANDLING ====================
    socket.on('group:join', (data) => {
        const { groupId } = data;
        if (!groupId) return;

        const groups = readJSON(GROUPS_FILE);
        const group = groups.find(g => g.id === groupId);
        if (!group) {
            socket.emit('group:error', { message: 'Group not found' });
            return;
        }

        if (!group.members.includes(userId)) {
            group.members.push(userId);
            writeJSON(GROUPS_FILE, groups);
        }

        socket.join(`group_${groupId}`);
        socket.emit('group:joined', { success: true, group });
    });

    socket.on('group:leave', (data) => {
        const { groupId } = data;
        if (!groupId) return;

        const groups = readJSON(GROUPS_FILE);
        const group = groups.find(g => g.id === groupId);
        if (!group) {
            socket.emit('group:error', { message: 'Group not found' });
            return;
        }

        group.members = group.members.filter(m => m !== userId);
        writeJSON(GROUPS_FILE, groups);
        socket.leave(`group_${groupId}`);
        socket.emit('group:left', { success: true });
    });

    // ==================== DISCONNECT ====================
    socket.on('disconnect', () => {
        console.log(`🔌 User ${userId} disconnected`);

        // Remove from online users
        onlineUsers.delete(userId);
        userSockets.delete(socket.id);

        // Clear typing timers
        for (const [key, timer] of typingUsers) {
            if (key.includes(userId)) {
                clearTimeout(timer);
                typingUsers.delete(key);
            }
        }

        // Update user status
        updateUserStatus(userId, false);

        // Notify others
        socket.broadcast.emit('user:offline', { userId });
    });
});

// ==================== HELPER FUNCTIONS ====================
function getUserData(userId) {
    try {
        const users = readJSON(USERS_FILE);
        return users.find(u => u.id === userId);
    } catch (error) {
        console.error('Error getting user data:', error);
        return null;
    }
}

function updateUserStatus(userId, online) {
    try {
        const users = readJSON(USERS_FILE);
        const user = users.find(u => u.id === userId);
        if (user) {
            user.online = online;
            user.lastSeen = online ? null : new Date().toISOString();
            writeJSON(USERS_FILE, users);
        }
    } catch (error) {
        console.error('Error updating user status:', error);
    }
}

// ==================== BROADCAST FUNCTIONS ====================
export function broadcastMessage(message) {
    io.emit('broadcast', message);
}

export function sendToUser(userId, event, data) {
    const socketId = onlineUsers.get(userId);
    if (socketId) {
        io.to(socketId).emit(event, data);
        return true;
    }
    return false;
}

export function getOnlineUsers() {
    return Array.from(onlineUsers.keys());
}

export function isUserOnline(userId) {
    return onlineUsers.has(userId);
}

// ==================== STARTUP ====================
console.log('🔌 SCORPION X WebSocket server initialized');

// Export for use in server.js
export { io, httpServer };

// If running standalone
if (process.env.WS_STANDALONE === 'true') {
    console.log(`🔌 WebSocket server running on port ${WS_PORT}`);
}

export default io;
