// ============================================================
// SCORPION X – CHAT.JS
// Complete Chat System with all features
// ============================================================

// ==================== CONFIGURATION ====================
const CHAT_CONFIG = {
    wsUrl: window.location.origin.replace('http', 'ws') + '/ws',
    apiUrl: '/api/chat',
    pollingInterval: 3000,
    maxMessages: 50,
    universalChannelId: 'universal_channel',
    universalChannelName: '📢 SCORPION X Official',
    universalChannelVerified: true,
};

// ==================== STATE ====================
let chatState = {
    currentChat: null, // { type: 'user'|'group'|'channel', id, name, avatar }
    chats: [],
    messages: [],
    contacts: [],
    groups: [],
    channels: [],
    onlineUsers: [],
    typingTimeout: null,
    isTyping: false,
    currentUser: null,
    ws: null,
};

// ==================== DOM ELEMENTS ====================
const DOM = {
    contactList: document.getElementById('contactList'),
    messagesArea: document.getElementById('messagesArea'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    chatName: document.getElementById('chatName'),
    chatStatus: document.getElementById('chatStatus'),
    chatAvatar: document.getElementById('chatAvatar'),
    verifiedBadge: document.getElementById('verifiedBadge'),
    searchInput: document.getElementById('searchInput'),
};

// ==================== SOCKET.IO / WEBSOCKET ====================
function connectWebSocket() {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!token) return;

    try {
        // Try Socket.IO first, fallback to WebSocket
        if (typeof io !== 'undefined') {
            chatState.ws = io(CHAT_CONFIG.wsUrl, {
                transports: ['websocket'],
                auth: { token }
            });
            setupSocketIOEvents();
        } else {
            // Fallback to raw WebSocket
            const ws = new WebSocket(`${CHAT_CONFIG.wsUrl}?token=${token}`);
            chatState.ws = ws;
            setupWebSocketEvents(ws);
        }
    } catch (e) {
        console.warn('WebSocket not available, using polling:', e);
        // Fallback to polling
        setupPolling();
    }
}

function setupSocketIOEvents() {
    const socket = chatState.ws;
    if (!socket) return;

    socket.on('connect', () => {
        console.log('🔌 Socket connected');
        socket.emit('authenticate', { token: localStorage.getItem('authToken') });
    });

    socket.on('authenticated', (data) => {
        console.log('✅ Authenticated:', data);
        chatState.currentUser = data.user;
        loadChats();
        loadContacts();
        loadGroups();
        loadChannels();
    });

    socket.on('message:new', (message) => {
        handleNewMessage(message);
    });

    socket.on('message:delivered', (data) => {
        updateMessageStatus(data.messageId, 'delivered');
    });

    socket.on('message:read', (data) => {
        updateMessageStatus(data.messageId, 'read');
    });

    socket.on('typing:start', (data) => {
        if (chatState.currentChat && chatState.currentChat.id === data.chatId) {
            DOM.chatStatus.innerHTML = `<span class="typing">${data.userName} is typing...</span>`;
        }
    });

    socket.on('typing:stop', (data) => {
        if (chatState.currentChat && chatState.currentChat.id === data.chatId) {
            updateChatStatus(chatState.currentChat);
        }
    });

    socket.on('user:online', (data) => {
        chatState.onlineUsers.push(data.userId);
        updateOnlineStatus(data.userId, true);
    });

    socket.on('user:offline', (data) => {
        chatState.onlineUsers = chatState.onlineUsers.filter(id => id !== data.userId);
        updateOnlineStatus(data.userId, false);
    });

    socket.on('disconnect', () => {
        console.log('🔌 Socket disconnected');
    });
}

function setupWebSocketEvents(ws) {
    ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        ws.send(JSON.stringify({
            type: 'authenticate',
            token: localStorage.getItem('authToken')
        }));
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (e) {
            console.error('Error parsing WebSocket message:', e);
        }
    };

    ws.onclose = () => {
        console.log('🔌 WebSocket disconnected, reconnecting in 3s...');
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'authenticated':
            chatState.currentUser = data.user;
            loadChats();
            loadContacts();
            loadGroups();
            loadChannels();
            break;
        case 'message:new':
            handleNewMessage(data.message);
            break;
        case 'typing:start':
            if (chatState.currentChat && chatState.currentChat.id === data.chatId) {
                DOM.chatStatus.innerHTML = `<span class="typing">${data.userName} is typing...</span>`;
            }
            break;
        case 'typing:stop':
            if (chatState.currentChat && chatState.currentChat.id === data.chatId) {
                updateChatStatus(chatState.currentChat);
            }
            break;
        default:
            console.log('Unknown WebSocket message:', data);
    }
}

function setupPolling() {
    console.log('📡 Using polling fallback');
    setInterval(() => {
        if (chatState.currentChat) {
            loadMessages(chatState.currentChat.id, chatState.currentChat.type);
        }
        loadChats();
    }, CHAT_CONFIG.pollingInterval);
}

// ==================== API CALLS ====================
function getHeaders() {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

async function apiCall(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: getHeaders(),
        };
        if (body) {
            options.body = JSON.stringify(body);
        }
        const res = await fetch(endpoint, options);
        const data = await res.json();
        if (!data.success && data.message === 'Unauthorized') {
            localStorage.removeItem('authToken');
            sessionStorage.removeItem('authToken');
            window.location.href = '/login.html';
        }
        return data;
    } catch (err) {
        console.error('API call error:', err);
        return { success: false, message: err.message };
    }
}

// ==================== LOAD CHATS ====================
async function loadChats() {
    try {
        const data = await apiCall('/api/chat/chats');
        if (data.success) {
            // Add Universal Channel (always first, cannot be unfollowed)
            const universalChat = {
                id: CHAT_CONFIG.universalChannelId,
                type: 'channel',
                name: CHAT_CONFIG.universalChannelName,
                avatar: '📢',
                verified: CHAT_CONFIG.universalChannelVerified,
                isUniversal: true,
                lastMessage: data.universalLastMessage || 'Welcome to SCORPION X Official Channel!',
                time: 'Now',
                unread: 0,
            };
            chatState.chats = [universalChat, ...(data.chats || [])];
            renderChatList(chatState.chats);
        }
    } catch (err) {
        console.error('Error loading chats:', err);
    }
}

// ==================== RENDER CHAT LIST ====================
function renderChatList(chats) {
    if (!DOM.contactList) return;

    if (!chats || chats.length === 0) {
        DOM.contactList.innerHTML = `
            <div style="text-align:center; color:var(--text-secondary); padding:30px 15px;">
                <i class="fas fa-inbox" style="font-size:2rem; opacity:0.3;"></i>
                <p style="margin-top:10px;">No chats yet</p>
                <p style="font-size:0.8rem;">Start a conversation or create a group</p>
            </div>
        `;
        return;
    }

    DOM.contactList.innerHTML = chats.map(chat => {
        const isUniversal = chat.isUniversal;
        const verifiedBadge = chat.verified ? '<i class="fas fa-check-circle" style="color:#25D366; font-size:0.6rem;"></i>' : '';
        const universalBadge = isUniversal ? '<span class="universal-badge">Verified</span>' : '';
        const onlineStatus = chat.online ? 'online' : 'offline';
        const avatarText = chat.avatar || chat.name.charAt(0).toUpperCase();

        return `
            <div class="chat-item" data-id="${chat.id}" data-type="${chat.type || 'user'}" onclick="selectChat('${chat.id}', '${chat.type || 'user'}')">
                <div class="avatar">
                    ${chat.avatar && chat.avatar.startsWith('http') ? `<img src="${chat.avatar}" alt="${chat.name}">` : avatarText}
                    <span class="online-dot ${onlineStatus}"></span>
                    ${verifiedBadge}
                </div>
                <div class="info">
                    <div class="name">
                        ${chat.name}
                        ${universalBadge}
                        ${verifiedBadge}
                    </div>
                    <div class="last-msg">${chat.lastMessage || 'No messages'}</div>
                </div>
                <div class="meta">
                    <div class="time">${chat.time || ''}</div>
                    ${chat.unread > 0 ? `<span class="unread">${chat.unread}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ==================== SELECT CHAT ====================
async function selectChat(chatId, type) {
    const chat = findChat(chatId, type);
    if (!chat) return;

    chatState.currentChat = { id: chatId, type, name: chat.name, avatar: chat.avatar, verified: chat.verified };
    updateChatHeader(chat);
    await loadMessages(chatId, type);
    markAsRead(chatId, type);

    // Hide sidebar on mobile
    if (window.innerWidth <= 768) {
        document.getElementById('chatSidebar').classList.add('hidden');
    }

    // Send typing stop
    if (chatState.ws) {
        chatState.ws.send(JSON.stringify({
            type: 'typing:stop',
            chatId,
            chatType: type
        }));
    }
}

function findChat(chatId, type) {
    return chatState.chats.find(c => c.id === chatId && (c.type === type || !c.type));
}

function updateChatHeader(chat) {
    const name = chat.name || 'Unknown';
    const avatar = chat.avatar || name.charAt(0).toUpperCase();
    const verified = chat.verified || false;

    DOM.chatName.innerHTML = `${name} ${verified ? '<span class="verified"><i class="fas fa-check-circle"></i></span>' : ''}`;
    DOM.chatAvatar.textContent = avatar;
    if (avatar.startsWith('http')) {
        DOM.chatAvatar.innerHTML = `<img src="${avatar}" alt="${name}">`;
    }
    updateChatStatus(chat);
}

function updateChatStatus(chat) {
    if (chat.isUniversal) {
        DOM.chatStatus.textContent = '🔊 Official Channel • Verified';
        return;
    }
    if (chat.online) {
        DOM.chatStatus.textContent = '🟢 Online';
    } else if (chat.lastSeen) {
        DOM.chatStatus.textContent = `Last seen ${chat.lastSeen}`;
    } else {
        DOM.chatStatus.textContent = 'Offline';
    }
}

// ==================== LOAD MESSAGES ====================
async function loadMessages(chatId, type) {
    try {
        const data = await apiCall(`/api/chat/messages?chatId=${chatId}&type=${type}`);
        if (data.success) {
            chatState.messages = data.messages || [];
            renderMessages(chatState.messages);
            scrollToBottom();
        }
    } catch (err) {
        console.error('Error loading messages:', err);
    }
}

// ==================== RENDER MESSAGES ====================
function renderMessages(messages) {
    if (!DOM.messagesArea) return;

    if (!messages || messages.length === 0) {
        DOM.messagesArea.innerHTML = `
            <div style="text-align:center; color:var(--text-secondary); padding:30px 0;">
                <i class="fas fa-comment" style="font-size:2rem; opacity:0.3;"></i>
                <p style="margin-top:10px;">No messages yet</p>
                <p style="font-size:0.8rem;">Say hello! 👋</p>
            </div>
        `;
        return;
    }

    let lastDate = '';
    let html = '';

    messages.forEach((msg, index) => {
        const msgDate = new Date(msg.timestamp).toDateString();
        if (msgDate !== lastDate) {
            html += `<div class="date-divider">${formatDate(msgDate)}</div>`;
            lastDate = msgDate;
        }

        const isSent = msg.senderId === chatState.currentUser?.id;
        const status = msg.status || 'sent';
        const statusIcon = status === 'read' ? '✓✓' : status === 'delivered' ? '✓' : '';

        let mediaHtml = '';
        if (msg.mediaUrl) {
            const isImage = msg.mediaType?.startsWith('image/');
            const isVideo = msg.mediaType?.startsWith('video/');
            const isAudio = msg.mediaType?.startsWith('audio/');
            if (isImage) {
                mediaHtml = `<img src="${msg.mediaUrl}" class="msg-media" onclick="window.open('${msg.mediaUrl}')">`;
            } else if (isVideo) {
                mediaHtml = `<video src="${msg.mediaUrl}" class="msg-media" controls onclick="event.stopPropagation();"></video>`;
            } else if (isAudio) {
                mediaHtml = `<audio src="${msg.mediaUrl}" controls class="msg-media" style="width:100%;"></audio>`;
            } else {
                mediaHtml = `<a href="${msg.mediaUrl}" target="_blank" class="msg-media" style="display:inline-block; padding:5px 10px; background:rgba(255,255,255,0.05); border-radius:8px;">📎 ${msg.mediaName || 'File'}</a>`;
            }
        }

        let replyHtml = '';
        if (msg.replyTo) {
            replyHtml = `<div class="msg-reply"><strong>${msg.replyTo.senderName}</strong> ${msg.replyTo.text}</div>`;
        }

        let reactionsHtml = '';
        if (msg.reactions && Object.keys(msg.reactions).length > 0) {
            reactionsHtml = `<div class="msg-reactions">${Object.entries(msg.reactions).map(([emoji, count]) => 
                `<span class="reaction">${emoji} ${count}</span>`
            ).join('')}</div>`;
        }

        html += `
            <div class="message ${isSent ? 'sent' : 'received'}" data-id="${msg.id}">
                ${replyHtml}
                ${mediaHtml}
                ${msg.text ? msg.text : ''}
                <div class="msg-time">
                    ${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                    ${isSent ? `<span class="msg-status ${status}">${statusIcon}</span>` : ''}
                </div>
                ${reactionsHtml}
            </div>
        `;
    });

    DOM.messagesArea.innerHTML = html;
}

// ==================== SEND MESSAGE ====================
async function sendMessage() {
    const text = DOM.messageInput.value.trim();
    if (!text && !pendingFile) return;
    if (!chatState.currentChat) {
        showToast('💬 Error', 'Please select a chat first');
        return;
    }

    const message = {
        chatId: chatState.currentChat.id,
        chatType: chatState.currentChat.type,
        text: text || '',
        media: pendingFile || null,
        timestamp: new Date().toISOString(),
    };

    // Reset input
    DOM.messageInput.value = '';
    pendingFile = null;

    // Optimistically add message
    const tempId = 'temp_' + Date.now();
    const tempMessage = {
        id: tempId,
        ...message,
        senderId: chatState.currentUser?.id,
        status: 'sending',
        timestamp: new Date().toISOString(),
    };
    chatState.messages.push(tempMessage);
    renderMessages(chatState.messages);
    scrollToBottom();

    // Send via WebSocket or API
    if (chatState.ws && chatState.ws.readyState === WebSocket.OPEN) {
        chatState.ws.send(JSON.stringify({
            type: 'message:send',
            ...message,
        }));
    } else {
        // Fallback to API
        try {
            const data = await apiCall('/api/chat/send', 'POST', message);
            if (data.success) {
                // Replace temp message with real one
                const index = chatState.messages.findIndex(m => m.id === tempId);
                if (index !== -1) {
                    chatState.messages[index] = data.message;
                    renderMessages(chatState.messages);
                }
            }
        } catch (err) {
            console.error('Error sending message:', err);
            showToast('❌ Error', 'Failed to send message');
        }
    }
}

// ==================== FILE UPLOAD ====================
let pendingFile = null;

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showToast('❌ Error', 'File too large (max 10MB)');
        return;
    }

    pendingFile = {
        name: file.name,
        size: file.size,
        type: file.type,
        data: file,
    };

    showToast('📎 File attached', `${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    event.target.value = '';
}

// ==================== TYPING INDICATOR ====================
let typingTimeout = null;

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
        return;
    }

    // Typing indicator
    if (chatState.currentChat && chatState.ws) {
        if (!chatState.isTyping) {
            chatState.isTyping = true;
            chatState.ws.send(JSON.stringify({
                type: 'typing:start',
                chatId: chatState.currentChat.id,
                chatType: chatState.currentChat.type,
            }));
        }
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            chatState.isTyping = false;
            chatState.ws.send(JSON.stringify({
                type: 'typing:stop',
                chatId: chatState.currentChat.id,
                chatType: chatState.currentChat.type,
            }));
        }, 1500);
    }
}

// ==================== HANDLE NEW MESSAGE ====================
function handleNewMessage(message) {
    // Add to messages if current chat
    if (chatState.currentChat && chatState.currentChat.id === message.chatId) {
        chatState.messages.push(message);
        renderMessages(chatState.messages);
        scrollToBottom();
    }

    // Update chat list
    const chat = chatState.chats.find(c => c.id === message.chatId);
    if (chat) {
        chat.lastMessage = message.text || 'Media message';
        chat.time = 'Just now';
        if (message.senderId !== chatState.currentUser?.id) {
            chat.unread = (chat.unread || 0) + 1;
        }
        renderChatList(chatState.chats);
    }
}

// ==================== MARK AS READ ====================
async function markAsRead(chatId, type) {
    if (!chatId) return;
    try {
        await apiCall('/api/chat/mark-read', 'POST', { chatId, type });
        const chat = chatState.chats.find(c => c.id === chatId);
        if (chat) {
            chat.unread = 0;
            renderChatList(chatState.chats);
        }
        if (chatState.ws) {
            chatState.ws.send(JSON.stringify({
                type: 'message:read',
                chatId,
                chatType: type,
            }));
        }
    } catch (err) {
        console.error('Error marking as read:', err);
    }
}

// ==================== UPDATE MESSAGE STATUS ====================
function updateMessageStatus(messageId, status) {
    const message = chatState.messages.find(m => m.id === messageId);
    if (message) {
        message.status = status;
        renderMessages(chatState.messages);
    }
}

// ==================== UPDATE ONLINE STATUS ====================
function updateOnlineStatus(userId, online) {
    const chat = chatState.chats.find(c => c.id === userId);
    if (chat) {
        chat.online = online;
        renderChatList(chatState.chats);
        if (chatState.currentChat && chatState.currentChat.id === userId) {
            updateChatStatus(chat);
        }
    }
}

// ==================== SEARCH CHATS ====================
function searchChats(query) {
    const filtered = chatState.chats.filter(chat => 
        chat.name.toLowerCase().includes(query.toLowerCase())
    );
    renderChatList(filtered);
}

// ==================== SWITCH TAB ====================
function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');

    switch(tab) {
        case 'chats':
            renderChatList(chatState.chats);
            break;
        case 'groups':
            loadGroups();
            break;
        case 'channels':
            loadChannels();
            break;
        case 'contacts':
            loadContacts();
            break;
    }
}

// ==================== LOAD GROUPS ====================
async function loadGroups() {
    const data = await apiCall('/api/chat/groups');
    if (data.success) {
        chatState.groups = data.groups || [];
        renderGroupList(chatState.groups);
    }
}

function renderGroupList(groups) {
    if (!DOM.contactList) return;
    if (!groups || groups.length === 0) {
        DOM.contactList.innerHTML = `
            <div style="text-align:center; color:var(--text-secondary); padding:30px 15px;">
                <i class="fas fa-users" style="font-size:2rem; opacity:0.3;"></i>
                <p style="margin-top:10px;">No groups yet</p>
                <button class="btn-fire" style="margin-top:10px; padding:8px 20px; font-size:0.8rem;" onclick="createGroup()">
                    <i class="fas fa-plus"></i> Create Group
                </button>
            </div>
        `;
        return;
    }

    DOM.contactList.innerHTML = groups.map(group => `
        <div class="chat-item" onclick="selectChat('${group.id}', 'group')">
            <div class="avatar">${group.avatar || group.name.charAt(0).toUpperCase()}</div>
            <div class="info">
                <div class="name">${group.name} ${group.premium ? '<span class="badge">PREMIUM</span>' : ''}</div>
                <div class="last-msg">${group.members ? group.members.length + ' members' : ''}</div>
            </div>
            <div class="meta">
                ${group.unread > 0 ? `<span class="unread">${group.unread}</span>` : ''}
            </div>
        </div>
    `).join('');
}

// ==================== LOAD CHANNELS ====================
async function loadChannels() {
    const data = await apiCall('/api/chat/channels');
    if (data.success) {
        chatState.channels = data.channels || [];
        renderChannelList(chatState.channels);
    }
}

function renderChannelList(channels) {
    if (!DOM.contactList) return;
    if (!channels || channels.length === 0) {
        DOM.contactList.innerHTML = `
            <div style="text-align:center; color:var(--text-secondary); padding:30px 15px;">
                <i class="fas fa-bullhorn" style="font-size:2rem; opacity:0.3;"></i>
                <p style="margin-top:10px;">No channels available</p>
                <p style="font-size:0.8rem;">Check back later for updates</p>
            </div>
        `;
        return;
    }

    // Universal channel is always first
    const universal = channels.find(c => c.isUniversal);
    const otherChannels = channels.filter(c => !c.isUniversal);

    let html = '';
    if (universal) {
        html += `
            <div class="chat-item active" onclick="selectChat('${universal.id}', 'channel')">
                <div class="avatar">📢</div>
                <div class="info">
                    <div class="name">${universal.name} <span class="universal-badge">Verified</span> <i class="fas fa-check-circle" style="color:#25D366; font-size:0.6rem;"></i></div>
                    <div class="last-msg">${universal.followers || 0} followers • ${universal.posts || 0} posts</div>
                </div>
            </div>
        `;
    }

    html += otherChannels.map(channel => `
        <div class="chat-item" onclick="selectChat('${channel.id}', 'channel')">
            <div class="avatar">${channel.avatar || channel.name.charAt(0).toUpperCase()}</div>
            <div class="info">
                <div class="name">${channel.name}</div>
                <div class="last-msg">${channel.followers || 0} followers</div>
            </div>
        </div>
    `).join('');

    DOM.contactList.innerHTML = html;
}

// ==================== LOAD CONTACTS ====================
async function loadContacts() {
    const data = await apiCall('/api/chat/contacts');
    if (data.success) {
        chatState.contacts = data.contacts || [];
        renderContactList(chatState.contacts);
    }
}

function renderContactList(contacts) {
    if (!DOM.contactList) return;
    if (!contacts || contacts.length === 0) {
        DOM.contactList.innerHTML = `
            <div style="text-align:center; color:var(--text-secondary); padding:30px 15px;">
                <i class="fas fa-user-friends" style="font-size:2rem; opacity:0.3;"></i>
                <p style="margin-top:10px;">No contacts found</p>
                <p style="font-size:0.8rem;">Search for users to start chatting</p>
                <div style="margin-top:15px;">
                    <input type="text" placeholder="Search users..." style="width:100%; padding:10px; border-radius:30px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,69,0,0.2); color:#fff;" onkeydown="if(event.key==='Enter') searchUsers(this.value)">
                </div>
            </div>
        `;
        return;
    }

    DOM.contactList.innerHTML = contacts.map(user => {
        const online = chatState.onlineUsers.includes(user.id) ? 'online' : 'offline';
        return `
            <div class="chat-item" onclick="selectChat('${user.id}', 'user')">
                <div class="avatar">
                    ${user.avatar ? `<img src="${user.avatar}">` : user.name.charAt(0).toUpperCase()}
                    <span class="online-dot ${online}"></span>
                    ${user.verified ? '<i class="fas fa-check-circle" style="position:absolute; bottom:-2px; right:-2px; color:#25D366; font-size:0.6rem;"></i>' : ''}
                </div>
                <div class="info">
                    <div class="name">${user.name} ${user.verified ? '<i class="fas fa-check-circle" style="color:#25D366; font-size:0.6rem;"></i>' : ''}</div>
                    <div class="last-msg">${online === 'online' ? '🟢 Online' : 'Offline'}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== SEARCH USERS ====================
async function searchUsers(query) {
    if (!query || query.length < 2) return;
    const data = await apiCall(`/api/chat/search?q=${encodeURIComponent(query)}`);
    if (data.success && data.users) {
        renderContactList(data.users);
    }
}

// ==================== CREATE GROUP ====================
async function createGroup() {
    const name = prompt('Enter group name:');
    if (!name) return;
    const data = await apiCall('/api/chat/groups', 'POST', { name });
    if (data.success) {
        showToast('✅ Group Created', `Group "${name}" created successfully!`);
        loadGroups();
        loadChats();
    } else {
        showToast('❌ Error', data.message || 'Failed to create group');
    }
}

// ==================== CLOSE CHAT ====================
function closeChat() {
    chatState.currentChat = null;
    document.getElementById('chatSidebar').classList.remove('hidden');
    DOM.chatName.textContent = 'Select a chat';
    DOM.chatStatus.textContent = 'Start messaging';
    DOM.chatAvatar.textContent = 'U';
    DOM.messagesArea.innerHTML = `
        <div style="text-align:center; color:var(--text-secondary); padding:40px 0;">
            <i class="fas fa-comments" style="font-size:3rem; color:var(--fire-orange); opacity:0.3;"></i>
            <p style="margin-top:15px;">Select a chat to start messaging</p>
        </div>
    `;
}

// ==================== SCROLL TO BOTTOM ====================
function scrollToBottom() {
    if (DOM.messagesArea) {
        DOM.messagesArea.scrollTop = DOM.messagesArea.scrollHeight;
    }
}

// ==================== FORMAT DATE ====================
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('💬 SCORPION X Chat initializing...');
    connectWebSocket();

    // Add event listeners
    DOM.sendBtn.addEventListener('click', sendMessage);
    DOM.messageInput.addEventListener('keydown', handleKeyDown);

    showToast('💬 Chat', 'Welcome to SCORPION X Chat!');
});
