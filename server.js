/**
 * ============================================================
 * SCORPION X – MAIN SERVER
 * Version: 3.0.0
 * Compatible with: Render, Vercel, Docker, Node.js 20+
 * ============================================================
 */

import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import pino from 'pino';
import QRCode from 'qrcode';
import pn from 'awesome-phonenumber';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import crypto from 'crypto';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

// ==================== LOAD ENV ====================
dotenv.config();

// ==================== IMPORTS ====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import custom modules
import pairRouter from './pair.js';
import { encodeSession, randomId } from './session.js';
import { sendSessionMessage } from './lib/message.js';

// ==================== APP SETUP ====================
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'scorpion_x_secret_key_change_me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ZentrixTechOfficial';

// ==================== MIDDLEWARE ====================
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));

// ==================== HTTP & WEBSOCKET SERVER ====================
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
        credentials: true
    },
    path: '/ws',
    pingInterval: 30000,
    pingTimeout: 10000,
});

// ==================== FILE STORAGE ====================
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const BUGS_FILE = path.join(DATA_DIR, 'bugs.json');
const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const PRICING_FILE = path.join(DATA_DIR, 'pricing.json');
const RESET_TOKENS_FILE = path.join(DATA_DIR, 'reset_tokens.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const CHAT_MEDIA_DIR = path.join(__dirname, 'chat_media');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(CHAT_MEDIA_DIR)) fs.mkdirSync(CHAT_MEDIA_DIR, { recursive: true });

// Initialize JSON files
const initJSON = (file, defaultData = []) => {
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
};
initJSON(USERS_FILE);
initJSON(BUGS_FILE);
initJSON(CHANNELS_FILE);
initJSON(GROUPS_FILE);
initJSON(MESSAGES_FILE);
initJSON(PRICING_FILE, { banCost: 10, unbanCost: 5, premiumCost: 11100, referralBonus: 55, dailyBonus: 50 });
initJSON(RESET_TOKENS_FILE);

// ==================== HELPERS ====================
const readJSON = (file) => JSON.parse(fs.readFileSync(file));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

function getRemainingTime(expiresAt) {
    if (!expiresAt) return null;
    const remaining = new Date(expiresAt) - Date.now();
    if (remaining <= 0) return 'Expired';
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (86400000)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
}

function generateReferralCode(userId, username) {
    const userPart = username.slice(0, 4).toUpperCase();
    const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
    const idPart = userId.slice(-4).toUpperCase();
    return `SCORPION_${userPart}_${randomPart}_${idPart}`;
}

// ==================== AUTH MIDDLEWARE ====================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token' });

        const users = readJSON(USERS_FILE);
        const user = users.find(u => u.id === decoded.id);
        if (!user || user.tokenVersion !== decoded.tokenVersion) {
            return res.status(403).json({ success: false, message: 'Session expired elsewhere' });
        }
        if (user.expiresAt && new Date(user.expiresAt) < Date.now()) {
            return res.status(403).json({ success: false, message: 'Account expired' });
        }
        req.user = decoded;
        next();
    });
}

function adminAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Admin token required' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
        req.admin = decoded;
        next();
    } catch (err) {
        res.status(403).json({ success: false, message: 'Invalid admin token' });
    }
}

// ==================== USER ROUTES ====================
app.post('/api/register', async (req, res) => {
    const { username, email, phone, age, password, referralCode } = req.body;
    if (!username || !email || !phone || !age || !password) {
        return res.json({ success: false, message: 'All fields required' });
    }
    if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email)) {
        return res.json({ success: false, message: 'Only Gmail addresses allowed' });
    }
    if (password.length < 6) {
        return res.json({ success: false, message: 'Password min 6 chars' });
    }

    const users = readJSON(USERS_FILE);
    if (users.find(u => u.email === email)) {
        return res.json({ success: false, message: 'Email already exists' });
    }
    if (users.find(u => u.username === username)) {
        return res.json({ success: false, message: 'Username taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID ? crypto.randomUUID() : randomId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const refCode = generateReferralCode(userId, username);

    // Handle referral
    let referralBonus = 0;
    if (referralCode) {
        const referrer = users.find(u => u.referralCode === referralCode);
        if (referrer) {
            referrer.coins = (referrer.coins || 0) + 55;
            referrer.totalReferrals = (referrer.totalReferrals || 0) + 1;
            referrer.coinsFromReferrals = (referrer.coinsFromReferrals || 0) + 55;
            referralBonus = 55;
            writeJSON(USERS_FILE, users);
        }
    }

    const newUser = {
        id: userId,
        username,
        email,
        phone,
        age: parseInt(age),
        passwordHash: hashedPassword,
        approved: false,
        tier: 'lite',
        coins: 150 + referralBonus,
        expiresAt,
        tokenVersion: 0,
        whatsappConnected: false,
        avatar: null,
        gender: 'Other',
        country: '',
        referralCode: refCode,
        referredBy: referralCode || null,
        totalReferrals: 0,
        coinsFromReferrals: referralBonus,
        lastDailyClaim: null,
        stats: { totalBans: 0, totalUnbans: 0 },
        createdAt: new Date().toISOString(),
        lastLoginAt: null
    };

    users.push(newUser);
    writeJSON(USERS_FILE, users);

    res.json({
        success: true,
        message: 'Registration pending admin approval',
        referralBonus: referralBonus
    });
});

app.post('/api/login', async (req, res) => {
    const { email, password, remember } = req.body;
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.email === email);

    if (!user) return res.json({ success: false, message: 'Invalid credentials' });
    if (!user.approved) return res.json({ success: false, message: 'Account pending approval', pendingApproval: true });
    if (user.expiresAt && new Date(user.expiresAt) < Date.now()) {
        return res.json({ success: false, message: 'Account expired' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.json({ success: false, message: 'Invalid credentials' });

    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.lastLoginAt = new Date().toISOString();
    writeJSON(USERS_FILE, users);

    const expiresIn = remember ? '7d' : '1d';
    const token = jwt.sign(
        { id: user.id, email: user.email, role: 'user', tokenVersion: user.tokenVersion },
        JWT_SECRET,
        { expiresIn }
    );

    res.json({
        success: true,
        token,
        tier: user.tier,
        expiresAt: user.expiresAt,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            coins: user.coins,
            isPremium: user.tier !== 'lite',
            approved: user.approved
        }
    });
});

app.get('/api/verify-session', authenticateToken, (req, res) => {
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.json({ success: false, message: 'User not found' });

    res.json({
        success: true,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            coins: user.coins || 0,
            isPremium: user.tier !== 'lite',
            avatar: user.avatar || null,
            tier: user.tier,
            expiresAt: user.expiresAt,
            remainingTime: getRemainingTime(user.expiresAt),
            approved: user.approved
        }
    });
});

app.post('/api/logout', (req, res) => {
    res.json({ success: true });
});

app.get('/api/user/profile', authenticateToken, (req, res) => {
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.json({ success: false, message: 'User not found' });

    res.json({
        success: true,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            phone: user.phone,
            age: user.age,
            gender: user.gender,
            country: user.country,
            avatar: user.avatar,
            approved: user.approved,
            tier: user.tier,
            coins: user.coins || 0,
            expiresAt: user.expiresAt,
            remainingTime: getRemainingTime(user.expiresAt),
            whatsappConnected: user.whatsappConnected || false,
            stats: user.stats || { totalBans: 0, totalUnbans: 0 },
            totalReferrals: user.totalReferrals || 0,
            referralCode: user.referralCode,
            coinsFromReferrals: user.coinsFromReferrals || 0,
            lastDailyClaim: user.lastDailyClaim || null
        }
    });
});

app.post('/api/user/update-profile', authenticateToken, (req, res) => {
    const { username, displayName, bio, status, phone, age, gender, country, pronouns } = req.body;
    const users = readJSON(USERS_FILE);
    const idx = users.findIndex(u => u.id === req.user.id);
    if (idx === -1) return res.json({ success: false, message: 'User not found' });

    if (username) {
        const existing = users.find(u => u.username === username && u.id !== req.user.id);
        if (existing) return res.json({ success: false, message: 'Username taken' });
        users[idx].username = username;
    }
    if (displayName) users[idx].displayName = displayName;
    if (bio) users[idx].bio = bio;
    if (status) users[idx].status = status;
    if (phone) users[idx].phone = phone;
    if (age) users[idx].age = parseInt(age);
    if (gender) users[idx].gender = gender;
    if (country) users[idx].country = country;
    if (pronouns) users[idx].pronouns = pronouns;

    writeJSON(USERS_FILE, users);
    res.json({ success: true });
});

app.post('/api/user/change-password', authenticateToken, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.json({ success: false, message: 'User not found' });

    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) return res.json({ success: false, message: 'Current password incorrect' });

    if (newPassword.length < 6) return res.json({ success: false, message: 'New password too short' });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    writeJSON(USERS_FILE, users);
    res.json({ success: true });
});

const uploadAvatar = multer({ dest: UPLOADS_DIR, limits: { fileSize: 5 * 1024 * 1024 } });
app.post('/api/user/upload-avatar', authenticateToken, uploadAvatar.single('avatar'), (req, res) => {
    if (!req.file) return res.json({ success: false, message: 'No file' });
    const ext = path.extname(req.file.originalname);
    const filename = `avatar_${req.user.id}${ext}`;
    const newPath = path.join(UPLOADS_DIR, filename);
    fs.renameSync(req.file.path, newPath);
    const avatarUrl = `/uploads/${filename}`;

    const users = readJSON(USERS_FILE);
    const idx = users.findIndex(u => u.id === req.user.id);
    if (idx !== -1) users[idx].avatar = avatarUrl;
    writeJSON(USERS_FILE, users);
    res.json({ success: true, avatarUrl });
});

app.post('/api/user/delete-account', authenticateToken, (req, res) => {
    const users = readJSON(USERS_FILE);
    const filtered = users.filter(u => u.id !== req.user.id);
    writeJSON(USERS_FILE, filtered);
    res.json({ success: true });
});

app.get('/api/user/status', authenticateToken, (req, res) => {
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.json({ success: false, message: 'User not found' });

    res.json({
        success: true,
        coins: user.coins || 0,
        premium: user.tier !== 'lite',
        tier: user.tier,
        expiresAt: user.expiresAt,
        remainingTime: getRemainingTime(user.expiresAt),
        approved: user.approved,
        stats: user.stats || { totalBans: 0, totalUnbans: 0 }
    });
});

app.get('/api/user/device-status', authenticateToken, (req, res) => {
    // Check if there's an active WhatsApp session for this user
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.id === req.user.id);
    const connected = user?.whatsappConnected || false;
    res.json({ success: true, connected, phoneNumber: user?.phone || null });
});

// ==================== DASHBOARD ====================
app.get('/api/user/dashboard', authenticateToken, (req, res) => {
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.json({ success: false, message: 'User not found' });

    res.json({
        success: true,
        user: {
            username: user.username || 'Warrior',
            coins: user.coins || 0,
            isPremium: user.tier !== 'lite',
            expiresAt: user.expiresAt,
            remainingTime: getRemainingTime(user.expiresAt),
            stats: user.stats || { totalBans: 0, totalUnbans: 0 },
            totalReferrals: user.totalReferrals || 0,
            whatsappConnected: user.whatsappConnected || false,
            tier: user.tier
        },
        connected: user.whatsappConnected || false,
        announcement: 'Welcome to SCORPION X! Connect your WhatsApp to start dominating.',
        activities: [
            { icon: 'fas fa-skull', title: 'Welcome!', description: 'Your journey begins here.', time: 'Just now' }
        ],
        onlineUsers: 0
    });
});

// ==================== FORGOT PASSWORD ====================
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.email === email);
    if (!user) return res.json({ success: false, message: 'Email not found' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 3600000;
    let tokens = readJSON(RESET_TOKENS_FILE);
    tokens = tokens.filter(t => t.email !== email);
    tokens.push({ email, token, expires });
    writeJSON(RESET_TOKENS_FILE, tokens);

    console.log(`🔐 Password reset link for ${email}: http://localhost:${PORT}/reset-password.html?token=${token}`);
    res.json({ success: true, message: 'Reset link sent (check console)' });
});

app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    let tokens = readJSON(RESET_TOKENS_FILE);
    const entry = tokens.find(t => t.token === token && t.expires > Date.now());
    if (!entry) return res.json({ success: false, message: 'Invalid or expired token' });

    const users = readJSON(USERS_FILE);
    const idx = users.findIndex(u => u.email === entry.email);
    if (idx === -1) return res.json({ success: false, message: 'User not found' });

    users[idx].passwordHash = await bcrypt.hash(newPassword, 10);
    writeJSON(USERS_FILE, users);

    tokens = tokens.filter(t => t.token !== token);
    writeJSON(RESET_TOKENS_FILE, tokens);
    res.json({ success: true });
});

// ==================== COINS & REFERRALS ====================
app.post('/api/claim-daily', authenticateToken, async (req, res) => {
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.json({ success: false, message: 'User not found' });

    const now = Date.now();
    const lastClaim = user.lastDailyClaim || 0;
    const cooldown = 24 * 60 * 60 * 1000;

    if (now - lastClaim < cooldown) {
        const remaining = cooldown - (now - lastClaim);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return res.json({ success: false, message: `Available in ${hours}h ${minutes}m`, remaining });
    }

    const bonus = user.tier !== 'lite' ? 15 : 5;
    user.coins = (user.coins || 0) + bonus;
    user.lastDailyClaim = now;
    writeJSON(USERS_FILE, users);

    res.json({ success: true, amount: bonus, newBalance: user.coins });
});

app.get('/api/referral/stats', authenticateToken, (req, res) => {
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.json({ success: false, message: 'User not found' });

    res.json({
        success: true,
        totalReferrals: user.totalReferrals || 0,
        coinsEarned: user.coinsFromReferrals || 0,
        pending: 0,
        rank: Math.floor((user.totalReferrals || 0) / 5) + 1
    });
});

app.get('/api/coin/history', authenticateToken, (req, res) => {
    // Mock coin history - can be expanded later
    res.json({
        success: true,
        history: [
            { type: 'earned', title: 'Welcome Bonus', description: 'New user bonus', amount: 150, time: 'Just now' }
        ]
    });
});

// ==================== BUGS ====================
app.get('/api/bugs', authenticateToken, (req, res) => {
    const bugs = readJSON(BUGS_FILE);
    res.json({
        success: true,
        bugs: bugs.map(b => ({
            id: b.id,
            name: b.name,
            category: b.category,
            description: b.description,
            targetPlaceholder: b.targetPlaceholder,
            icon: b.icon || 'fas fa-bug',
            premiumOnly: b.premiumOnly || false,
            price: b.price || 0,
            stats: b.stats || { executions: 0, successRate: 0, coinsEarned: 0 }
        }))
    });
});

app.post('/api/bugs/execute', authenticateToken, async (req, res) => {
    const { bugId, target } = req.body;
    if (!bugId || !target) return res.json({ success: false, message: 'Bug ID and target required' });

    const bugs = readJSON(BUGS_FILE);
    const bug = bugs.find(b => b.id === bugId);
    if (!bug) return res.json({ success: false, message: 'Bug not found' });

    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.json({ success: false, message: 'User not found' });

    // Check premium
    if (bug.premiumOnly && user.tier === 'lite') {
        return res.json({ success: false, message: 'This bug requires premium account' });
    }

    // Check coins
    const price = bug.price || 0;
    if (price > 0 && user.coins < price) {
        return res.json({ success: false, message: `Insufficient coins (need ${price})` });
    }

    // Check WhatsApp connection
    if (!user.whatsappConnected) {
        return res.json({ success: false, message: 'WhatsApp not connected' });
    }

    // Deduct coins
    user.coins = (user.coins || 0) - price;
    user.stats = user.stats || { totalBans: 0, totalUnbans: 0 };
    user.stats.totalBans = (user.stats.totalBans || 0) + 1;
    bug.stats = bug.stats || { executions: 0, successRate: 0, coinsEarned: 0 };
    bug.stats.executions = (bug.stats.executions || 0) + 1;
    bug.stats.coinsEarned = (bug.stats.coinsEarned || 0) + price;
    writeJSON(USERS_FILE, users);
    writeJSON(BUGS_FILE, bugs);

    // Simulate execution
    setTimeout(() => {
        // Could send via WhatsApp here
    }, 100);

    res.json({
        success: true,
        message: `✅ Bug "${bug.name}" executed on ${target}`,
        newBalance: user.coins,
        bug: bug.name
    });
});

// ==================== ADMIN ROUTES ====================
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ success: true, token });
    } else {
        res.json({ success: false, message: 'Invalid admin password' });
    }
});

app.get('/api/admin/stats', adminAuth, (req, res) => {
    const users = readJSON(USERS_FILE);
    const bugs = readJSON(BUGS_FILE);
    const totalCoins = users.reduce((sum, u) => sum + (u.coins || 0), 0);
    res.json({
        success: true,
        totalUsers: users.length,
        approvedUsers: users.filter(u => u.approved).length,
        premiumUsers: users.filter(u => u.tier !== 'lite').length,
        connectedDevices: users.filter(u => u.whatsappConnected).length,
        totalBans: users.reduce((sum, u) => sum + (u.stats?.totalBans || 0), 0),
        totalCoins: totalCoins,
        totalBugs: bugs.length
    });
});

app.get('/api/admin/users', adminAuth, (req, res) => {
    const users = readJSON(USERS_FILE);
    res.json({
        success: true,
        users: users.map(u => ({
            id: u.id,
            email: u.email,
            phone: u.phone,
            age: u.age,
            approved: u.approved,
            premium: u.tier !== 'lite',
            tier: u.tier,
            whatsappConnected: u.whatsappConnected || false,
            coins: u.coins || 0,
            username: u.username || u.email.split('@')[0]
        }))
    });
});

app.post('/api/admin/approve-user', adminAuth, (req, res) => {
    const { userId } = req.body;
    const users = readJSON(USERS_FILE);
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return res.json({ success: false, message: 'User not found' });

    users[idx].approved = true;
    users[idx].expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    writeJSON(USERS_FILE, users);
    res.json({ success: true });
});

app.post('/api/admin/update-tier', adminAuth, (req, res) => {
    const { userId, tier, daysToAdd } = req.body;
    const users = readJSON(USERS_FILE);
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return res.json({ success: false, message: 'User not found' });

    if (tier) users[idx].tier = tier;
    if (daysToAdd) {
        const currentExpiry = users[idx].expiresAt ? new Date(users[idx].expiresAt) : new Date();
        const newExpiry = new Date(currentExpiry.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        users[idx].expiresAt = newExpiry.toISOString();
    }
    writeJSON(USERS_FILE, users);
    res.json({ success: true });
});

app.post('/api/admin/delete-user', adminAuth, (req, res) => {
    const { userId } = req.body;
    let users = readJSON(USERS_FILE);
    users = users.filter(u => u.id !== userId);
    writeJSON(USERS_FILE, users);
    res.json({ success: true });
});

app.post('/api/admin/create-user', adminAuth, async (req, res) => {
    const { email, phone, age, password, tier = 'lite', daysValid = 30 } = req.body;
    if (!email || !phone || !age || !password) {
        return res.json({ success: false, message: 'All fields required' });
    }

    const users = readJSON(USERS_FILE);
    if (users.find(u => u.email === email)) {
        return res.json({ success: false, message: 'Email exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID ? crypto.randomUUID() : randomId();
    const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000).toISOString();
    const username = email.split('@')[0];

    const newUser = {
        id: userId,
        username,
        email,
        phone,
        age: parseInt(age),
        passwordHash: hashed,
        approved: true,
        tier,
        coins: 150,
        expiresAt,
        tokenVersion: 0,
        whatsappConnected: false,
        avatar: null,
        gender: 'Other',
        country: '',
        referralCode: generateReferralCode(userId, username),
        referredBy: null,
        totalReferrals: 0,
        coinsFromReferrals: 0,
        lastDailyClaim: null,
        stats: { totalBans: 0, totalUnbans: 0 },
        createdAt: new Date().toISOString(),
        lastLoginAt: null
    };

    users.push(newUser);
    writeJSON(USERS_FILE, users);
    res.json({ success: true });
});

app.post('/api/admin/broadcast', adminAuth, (req, res) => {
    const { message, target, type = 'text' } = req.body;
    if (!message) return res.json({ success: false, message: 'Message required' });

    const users = readJSON(USERS_FILE);
    let recipients = users;
    if (target === 'approved') recipients = users.filter(u => u.approved);
    else if (target === 'premium') recipients = users.filter(u => u.tier !== 'lite');
    else if (target === 'connected') recipients = users.filter(u => u.whatsappConnected);

    console.log(`📢 Broadcast to ${recipients.length} users: ${message}`);
    res.json({ success: true, count: recipients.length });
});

app.get('/api/admin/bugs', adminAuth, (req, res) => {
    const bugs = readJSON(BUGS_FILE);
    res.json({ success: true, bugs });
});

app.post('/api/admin/add-bug', adminAuth, (req, res) => {
    const { name, category, description, targetPlaceholder, icon, price, premiumOnly, file, code } = req.body;
    if (!name || !category || !description || !code) {
        return res.json({ success: false, message: 'Missing fields' });
    }

    const bugs = readJSON(BUGS_FILE);
    const newBug = {
        id: crypto.randomUUID ? crypto.randomUUID() : randomId(),
        name,
        category,
        description,
        targetPlaceholder: targetPlaceholder || 'Target ID',
        icon: icon || 'fas fa-bug',
        price: price || 0,
        premiumOnly: !!premiumOnly,
        file: file || null,
        code,
        stats: { executions: 0, successRate: 0, coinsEarned: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    bugs.push(newBug);
    writeJSON(BUGS_FILE, bugs);
    res.json({ success: true });
});

app.post('/api/admin/delete-bug', adminAuth, (req, res) => {
    const { bugId } = req.body;
    let bugs = readJSON(BUGS_FILE);
    bugs = bugs.filter(b => b.id !== bugId);
    writeJSON(BUGS_FILE, bugs);
    res.json({ success: true });
});

// ==================== CHANNELS ====================
app.get('/api/admin/channels', adminAuth, (req, res) => {
    const channels = readJSON(CHANNELS_FILE);
    res.json({ success: true, channels });
});

app.post('/api/admin/add-channel', adminAuth, (req, res) => {
    const { name, jid } = req.body;
    if (!name || !jid) return res.json({ success: false, message: 'Name and JID required' });

    const channels = readJSON(CHANNELS_FILE);
    channels.push({
        id: crypto.randomUUID ? crypto.randomUUID() : randomId(),
        name,
        jid,
        createdAt: new Date().toISOString()
    });
    writeJSON(CHANNELS_FILE, channels);
    res.json({ success: true });
});

app.post('/api/admin/delete-channel', adminAuth, (req, res) => {
    const { channelId } = req.body;
    let channels = readJSON(CHANNELS_FILE);
    channels = channels.filter(c => c.id !== channelId);
    writeJSON(CHANNELS_FILE, channels);
    res.json({ success: true });
});

// ==================== GROUPS ====================
app.get('/api/admin/groups', adminAuth, (req, res) => {
    const groups = readJSON(GROUPS_FILE);
    res.json({ success: true, groups });
});

app.post('/api/admin/create-group', adminAuth, (req, res) => {
    const { name, premium } = req.body;
    if (!name) return res.json({ success: false, message: 'Name required' });

    const groups = readJSON(GROUPS_FILE);
    groups.push({
        id: crypto.randomUUID ? crypto.randomUUID() : randomId(),
        name,
        premium: !!premium,
        creator: req.admin.id || 'admin',
        members: [req.admin.id || 'admin'],
        createdAt: new Date().toISOString()
    });
    writeJSON(GROUPS_FILE, groups);
    res.json({ success: true });
});

app.post('/api/admin/delete-group', adminAuth, (req, res) => {
    const { groupId } = req.body;
    let groups = readJSON(GROUPS_FILE);
    groups = groups.filter(g => g.id !== groupId);
    writeJSON(GROUPS_FILE, groups);
    res.json({ success: true });
});

// ==================== PRICING ====================
app.get('/api/admin/pricing', adminAuth, (req, res) => {
    const pricing = readJSON(PRICING_FILE);
    res.json({ success: true, ...pricing });
});

app.post('/api/admin/save-pricing', adminAuth, (req, res) => {
    const { banCost, unbanCost, premiumCost, referralBonus, dailyBonus } = req.body;
    const pricing = { banCost, unbanCost, premiumCost, referralBonus, dailyBonus };
    writeJSON(PRICING_FILE, pricing);
    res.json({ success: true });
});

// ==================== LOGS ====================
app.get('/api/admin/logs', adminAuth, (req, res) => {
    const logs = [
        { message: 'System started', time: new Date().toLocaleString(), type: 'info' },
        { message: 'Admin panel accessed', time: new Date().toLocaleString(), type: 'info' }
    ];
    res.json({ success: true, logs });
});

// ==================== CHANNEL FOLLOW ====================
app.post('/api/channel/follow', authenticateToken, async (req, res) => {
    const { jid } = req.body;
    if (!jid) return res.json({ success: false, message: 'JID required' });

    // This would use the WhatsApp socket to follow the channel
    // For now, just log and return success
    console.log(`📢 User ${req.user.id} following channel: ${jid}`);
    res.json({ success: true, message: 'Channel followed' });
});

// ==================== UNBANS (Mock) ====================
app.get('/api/unbans', authenticateToken, (req, res) => {
    const unbans = [
        {
            id: 'unban_1',
            name: 'WhatsApp Unban',
            category: 'whatsapp',
            description: 'Request unban for WhatsApp number',
            targetPlaceholder: '+447123456789',
            icon: 'fab fa-whatsapp',
            premiumOnly: false,
            price: 5,
            stats: { executions: 45, successRate: 78, coinsEarned: 225 }
        },
        {
            id: 'unban_2',
            name: 'Instagram Unban',
            category: 'instagram',
            description: 'Request unban for Instagram account',
            targetPlaceholder: '@username',
            icon: 'fab fa-instagram',
            premiumOnly: false,
            price: 8,
            stats: { executions: 23, successRate: 65, coinsEarned: 184 }
        }
    ];
    res.json({ success: true, unbans });
});

app.post('/api/unban/execute', authenticateToken, async (req, res) => {
    const { unbanId, target } = req.body;
    if (!unbanId || !target) return res.json({ success: false, message: 'Unban ID and target required' });

    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.json({ success: false, message: 'User not found' });

    // Check WhatsApp connection
    if (!user.whatsappConnected) {
        return res.json({ success: false, message: 'WhatsApp not connected' });
    }

    // Deduct coins (mock)
    user.coins = (user.coins || 0) - 5;
    user.stats = user.stats || { totalBans: 0, totalUnbans: 0 };
    user.stats.totalUnbans = (user.stats.totalUnbans || 0) + 1;
    writeJSON(USERS_FILE, users);

    res.json({
        success: true,
        message: `✅ Unban request sent for ${target}`,
        newBalance: user.coins
    });
});

// ==================== CHAT ROUTES ====================
app.get('/api/chat/chats', authenticateToken, (req, res) => {
    const users = readJSON(USERS_FILE);
    const currentUser = users.find(u => u.id === req.user.id);
    const chats = users
        .filter(u => u.id !== req.user.id)
        .slice(0, 10)
        .map(u => ({
            id: u.id,
            type: 'user',
            name: u.username || u.email.split('@')[0],
            avatar: u.avatar,
            online: false,
            lastMessage: 'Hello!',
            time: 'Just now',
            unread: 0
        }));

    res.json({
        success: true,
        chats,
        universalLastMessage: 'Welcome to SCORPION X Official Channel!'
    });
});

app.get('/api/chat/messages', authenticateToken, (req, res) => {
    const { chatId, type } = req.query;
    if (!chatId || !type) return res.json({ success: false, message: 'Chat ID and type required' });

    const messages = readJSON(MESSAGES_FILE);
    const filtered = messages
        .filter(m => m.chatId === chatId && m.chatType === type)
        .slice(-50)
        .map(m => ({
            id: m.id,
            senderId: m.senderId,
            text: m.text || '',
            mediaUrl: m.mediaUrl || null,
            mediaType: m.mediaType || null,
            status: m.status || 'delivered',
            timestamp: m.timestamp || new Date().toISOString()
        }));

    res.json({ success: true, messages: filtered });
});

app.post('/api/chat/send', authenticateToken, (req, res) => {
    const { chatId, chatType, text, mediaUrl } = req.body;
    if (!chatId || !chatType) return res.json({ success: false, message: 'Chat ID and type required' });
    if (!text && !mediaUrl) return res.json({ success: false, message: 'No content' });

    const messages = readJSON(MESSAGES_FILE);
    const newMsg = {
        id: crypto.randomUUID ? crypto.randomUUID() : randomId(),
        chatId,
        chatType,
        senderId: req.user.id,
        text: text || '',
        mediaUrl: mediaUrl || null,
        mediaType: null,
        status: 'delivered',
        timestamp: new Date().toISOString()
    };

    messages.push(newMsg);
    writeJSON(MESSAGES_FILE, messages);

    // Broadcast via WebSocket
    io.emit('message:new', newMsg);

    res.json({ success: true, message: newMsg });
});

app.post('/api/chat/mark-read', authenticateToken, (req, res) => {
    const { chatId, type } = req.body;
    if (!chatId || !type) return res.json({ success: false, message: 'Chat ID and type required' });

    // Mark messages as read
    const messages = readJSON(MESSAGES_FILE);
    messages.forEach(m => {
        if (m.chatId === chatId && m.chatType === type && m.senderId !== req.user.id) {
            m.status = 'read';
        }
    });
    writeJSON(MESSAGES_FILE, messages);

    res.json({ success: true });
});

app.get('/api/chat/contacts', authenticateToken, (req, res) => {
    const users = readJSON(USERS_FILE);
    const contacts = users
        .filter(u => u.id !== req.user.id && u.approved)
        .slice(0, 20)
        .map(u => ({
            id: u.id,
            name: u.username || u.email.split('@')[0],
            avatar: u.avatar,
            verified: false,
            online: false
        }));

    res.json({ success: true, contacts });
});

app.get('/api/chat/groups', authenticateToken, (req, res) => {
    const groups = readJSON(GROUPS_FILE);
    const userGroups = groups.filter(g => g.members.includes(req.user.id));
    res.json({
        success: true,
        groups: userGroups.map(g => ({
            id: g.id,
            name: g.name,
            premium: g.premium || false,
            members: g.members.length || 0
        }))
    });
});

app.get('/api/chat/channels', authenticateToken, (req, res) => {
    const channels = readJSON(CHANNELS_FILE);
    const universal = {
        id: 'universal_channel',
        name: '📢 SCORPION X Official',
        description: 'Official announcements and updates',
        followers: 1,
        posts: 10,
        isUniversal: true,
        verified: true
    };
    res.json({
        success: true,
        channels: [universal, ...channels.map(c => ({
            id: c.id,
            name: c.name,
            jid: c.jid,
            followers: 1,
            posts: 0
        }))]
    });
});

app.get('/api/chat/search', authenticateToken, (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ success: true, users: [] });

    const users = readJSON(USERS_FILE);
    const results = users
        .filter(u =>
            u.id !== req.user.id &&
            (u.username?.toLowerCase().includes(q.toLowerCase()) ||
             u.email?.toLowerCase().includes(q.toLowerCase()))
        )
        .slice(0, 10)
        .map(u => ({
            id: u.id,
            name: u.username || u.email.split('@')[0],
            avatar: u.avatar,
            verified: false
        }));

    res.json({ success: true, users: results });
});

// ==================== UPLOADS ====================
app.use('/uploads', express.static(UPLOADS_DIR));

// ==================== PAIRING ROUTE ====================
app.use('/code', pairRouter);

// ==================== FALLBACK ====================
app.get('*', (req, res) => {
    const page = req.path.slice(1) || 'index.html';
    const filePath = path.join(__dirname, page);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.sendFile(path.join(__dirname, '404.html'));
    }
});

// ==================== WEBSOCKET HANDLERS ====================
io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
        return next(new Error('Authentication required'));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.id;
        next();
    } catch (err) {
        next(new Error('Invalid token'));
    }
});

io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.userId}`);

    // Authenticate
    socket.on('authenticate', (data) => {
        socket.emit('authenticated', { success: true, user: { id: socket.userId } });
    });

    // Typing indicators
    socket.on('typing:start', (data) => {
        socket.broadcast.emit('typing:start', { chatId: data.chatId, userName: 'User' });
    });

    socket.on('typing:stop', (data) => {
        socket.broadcast.emit('typing:stop', { chatId: data.chatId });
    });

    // Message read
    socket.on('message:read', (data) => {
        socket.broadcast.emit('message:read', { messageId: data.messageId });
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnected: ${socket.userId}`);
    });
});

// ==================== START SERVER ====================
httpServer.listen(PORT, () => {
    console.log(`🔥 SCORPION X Server running on http://localhost:${PORT}`);
    console.log(`📁 Static files served from ./public`);
    console.log(`📁 Data stored in ./data`);
    console.log(`🔌 WebSocket running on /ws`);
    console.log(`✅ Server ready for Render deployment`);
});

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down gracefully...');
    httpServer.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    httpServer.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
