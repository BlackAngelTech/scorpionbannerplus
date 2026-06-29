/**
 * ============================================================
 * SCORPION X – PAIR.JS
 * WhatsApp pairing with SCORPION X theme
 * Auto-follows channel: 120363407756240466@newsletter
 * Sends session with fire-themed messages
 * ============================================================
 */

import express from 'express';
import fs from 'fs-extra';
import pino from 'pino';
import {
    makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    fetchLatestBaileysVersion,
    DisconnectReason
} from '@whiskeysockets/baileys';
import pn from 'awesome-phonenumber';

const router = express.Router();

// ==================== CONFIGURATION ====================
const CHANNEL_JID = '120363407756240466@newsletter';
const BOT_NAME = '🔥 SCORPION X';
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const MAX_RECONNECT_ATTEMPTS = 3;

// ==================== HELPERS ====================
function removeFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) return false;
        fs.rmSync(filePath, { recursive: true, force: true });
        console.log(`🧹 Removed: ${filePath}`);
        return true;
    } catch (e) {
        console.error('Error removing file:', e);
        return false;
    }
}

// ==================== AUTO-FOLLOW CHANNEL ====================
async function autoFollowChannel(sock, userJid) {
    try {
        // Try newsletterFollow first
        if (typeof sock.newsletterFollow === 'function') {
            await sock.newsletterFollow(CHANNEL_JID);
            console.log(`✅ Auto-followed channel for ${userJid}`);
            return true;
        } else if (typeof sock.followNewsletter === 'function') {
            await sock.followNewsletter(CHANNEL_JID);
            console.log(`✅ Auto-followed channel (followNewsletter) for ${userJid}`);
            return true;
        } else {
            console.log(`⚠️ Newsletter follow function not available for ${userJid}`);
            return false;
        }
    } catch (err) {
        console.log(`⚠️ Auto-follow channel error for ${userJid}:`, err.message);
        return false;
    }
}

// ==================== SEND SCORPION X SESSION MESSAGE ====================
async function sendScorpionXMessage(sock, userJid, sessionBuffer) {
    try {
        // 1. Send session file
        await sock.sendMessage(userJid, {
            document: sessionBuffer,
            mimetype: 'application/json',
            fileName: 'scorpion_x_session.json'
        });
        console.log(`📄 Session file sent to ${userJid}`);

        // 2. Send fire-themed welcome message with video thumbnail
        await sock.sendMessage(userJid, {
            image: { url: 'https://files.catbox.moe/cam98u.jpg' },
            caption: `🔥 *SCORPION X CONNECTED* 🔥\n\n` +
                     `💀 *"GET OVER HERE!"*\n\n` +
                     `✅ Your WhatsApp is now linked to SCORPION X.\n` +
                     `🔐 Session file saved. Keep it secure!\n\n` +
                     `⚡ Features:\n` +
                     `• Ban Panel (Crash & Dominate)\n` +
                     `• Unban Panel (Restore Access)\n` +
                     `• Reels (Watch & Chill)\n` +
                     `• Chatroom (Connect with others)\n` +
                     `• Earn Coins (Daily claims & referrals)\n\n` +
                     `📢 *Auto-followed: SCORPION X Official Channel*\n\n` +
                     `🔥 "There is no mercy in this realm." 🔥`
        });
        console.log(`📱 Welcome message sent to ${userJid}`);

        // 3. Send warning message
        await sock.sendMessage(userJid, {
            text: `⚠️ *DO NOT SHARE THIS SESSION FILE WITH ANYONE* ⚠️\n\n` +
                  `┌┤✑  Your session is unique to you.\n` +
                  `│└────────────┈ ⳹\n` +
                  `│© 2026 ZENTRIX TECH \n` +
                  `└─────────────────┈ ⳹\n\n` +
                  `🔥 SCORPION X — "GET OVER HERE!" 🔥`
        });
        console.log(`⚠️ Warning message sent to ${userJid}`);

        // 4. Auto-follow channel
        await autoFollowChannel(sock, userJid);

        return true;
    } catch (error) {
        console.error('❌ Error sending messages:', error);
        return false;
    }
}

// ==================== MAIN ROUTE ====================
router.get('/', async (req, res) => {
    let num = req.query.number;
    if (!num) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    // Clean number
    const cleanNum = num.replace(/[^0-9]/g, '');
    if (cleanNum.length < 10) {
        return res.status(400).json({ error: 'Invalid phone number. Must be 10-15 digits.' });
    }

    // Validate with awesome-phonenumber
    const phone = pn('+' + cleanNum);
    if (!phone.isValid()) {
        return res.status(400).json({
            error: 'Invalid phone number. Please enter your full international number (e.g., 447911123456 for UK) without +.'
        });
    }

    // Use E.164 format without +
    const phoneNumber = phone.getNumber('e164').replace('+', '');

    // Generate unique session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const sessionPath = `./auth_info_baileys/${sessionId}`;

    let pairingCodeSent = false;
    let sessionCompleted = false;
    let responseSent = false;
    let currentSocket = null;
    let timeoutHandle = null;
    let reconnectAttempts = 0;

    // ==================== CLEANUP ====================
    async function cleanup(reason) {
        if (sessionCompleted) return;
        sessionCompleted = true;
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
        }
        if (currentSocket) {
            try {
                currentSocket.ev.removeAllListeners();
                await currentSocket.end();
            } catch (e) {}
            currentSocket = null;
        }
        setTimeout(async () => {
            await removeFile(sessionPath);
            console.log(`🧹 Cleaned up session: ${sessionId} (${reason || 'unknown'})`);
        }, 5000);
    }

    // ==================== INITIATE SESSION ====================
    async function initiateSession() {
        if (sessionCompleted) return;

        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            if (!responseSent && !res.headersSent) {
                responseSent = true;
                res.status(503).json({ error: 'Connection failed after multiple attempts' });
            }
            await cleanup('max_reconnects');
            return;
        }

        try {
            // Ensure directory exists
            await fs.ensureDir(sessionPath);

            // Load auth state
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
            const { version } = await fetchLatestBaileysVersion();

            // Create WhatsApp socket
            currentSocket = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(
                        state.keys,
                        pino({ level: 'fatal' }).child({ level: 'fatal' })
                    )
                },
                printQRInTerminal: false,
                logger: pino({ level: 'silent' }),
                browser: Browsers.macOS('Chrome'),
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 250,
                maxRetries: 3
            });

            const sock = currentSocket;

            // ============ CONNECTION UPDATE ============
            sock.ev.on('connection.update', async (update) => {
                if (sessionCompleted) return;
                const { connection, lastDisconnect } = update;

                if (connection === 'open') {
                    console.log(`✅ WhatsApp connected for ${phoneNumber}`);
                    sessionCompleted = true;

                    try {
                        // Read session file
                        const credsFile = `${sessionPath}/creds.json`;
                        if (fs.existsSync(credsFile)) {
                            const sessionBuffer = fs.readFileSync(credsFile);
                            const userJid = jidNormalizedUser(phoneNumber + '@s.whatsapp.net');

                            // Send SCORPION X themed session message
                            await sendScorpionXMessage(sock, userJid, sessionBuffer);
                            console.log(`✅ Session sent to ${phoneNumber}`);
                        }
                    } catch (error) {
                        console.error('❌ Error in connection open handler:', error);
                    } finally {
                        // Update user's WhatsApp connection status in database
                        try {
                            const users = JSON.parse(fs.readFileSync('./data/users.json', 'utf-8'));
                            const userIdx = users.findIndex(u => u.phone === phoneNumber || u.phone === `+${phoneNumber}`);
                            if (userIdx !== -1) {
                                users[userIdx].whatsappConnected = true;
                                users[userIdx].phone = phoneNumber;
                                fs.writeFileSync('./data/users.json', JSON.stringify(users, null, 2));
                                console.log(`✅ Updated user ${phoneNumber} connection status`);
                            }
                        } catch (err) {
                            console.error('Error updating user status:', err);
                        }

                        await cleanup('session_complete');
                    }
                }

                if (connection === 'close') {
                    if (sessionCompleted) {
                        await cleanup('already_complete');
                        return;
                    }

                    const statusCode = lastDisconnect?.error?.output?.statusCode;

                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        if (!responseSent && !res.headersSent) {
                            responseSent = true;
                            res.status(401).json({ error: 'Invalid pairing code or session expired' });
                        }
                        await cleanup('logged_out');
                    } else if (pairingCodeSent && !sessionCompleted) {
                        reconnectAttempts++;
                        console.log(`🔄 Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
                        await delay(2000);
                        await initiateSession();
                    } else {
                        await cleanup('connection_closed');
                    }
                }
            });

            // ============ REQUEST PAIRING CODE ============
            if (!sock.authState.creds.registered && !pairingCodeSent && !sessionCompleted) {
                await delay(1500);
                try {
                    pairingCodeSent = true;
                    let code = await sock.requestPairingCode(phoneNumber, 'SCORPIONX');

                    // Format code with dashes
                    code = code?.match(/.{1,4}/g)?.join('-') || code;

                    if (!responseSent && !res.headersSent) {
                        responseSent = true;
                        res.json({ code });
                        console.log(`📱 Pairing code sent for ${phoneNumber}: ${code}`);
                    }
                } catch (error) {
                    pairingCodeSent = false;
                    console.error('❌ Failed to get pairing code:', error.message);
                    if (!responseSent && !res.headersSent) {
                        responseSent = true;
                        res.status(503).json({ error: 'Failed to get pairing code. Please try again.' });
                    }
                    await cleanup('pairing_code_error');
                }
            }

            // ============ CREDS UPDATE ============
            sock.ev.on('creds.update', saveCreds);

            // ============ TIMEOUT ============
            timeoutHandle = setTimeout(async () => {
                if (!sessionCompleted && !responseSent && !res.headersSent) {
                    responseSent = true;
                    res.status(408).json({ error: 'Pairing timeout. Please try again.' });
                }
                await cleanup('timeout');
            }, SESSION_TIMEOUT);

        } catch (err) {
            console.error('❌ Error initializing session:', err);
            if (!responseSent && !res.headersSent) {
                responseSent = true;
                res.status(503).json({ error: 'Service Unavailable' });
            }
            await cleanup('init_error');
        }
    }

    await initiateSession();
});

// ==================== CLEANUP STALE SESSIONS ====================
setInterval(async () => {
    try {
        const baseDir = './auth_info_baileys';
        if (!fs.existsSync(baseDir)) return;

        const sessions = await fs.readdir(baseDir);
        const now = Date.now();

        for (const session of sessions) {
            try {
                const stats = await fs.stat(`${baseDir}/${session}`);
                // Remove sessions older than 10 minutes
                if (now - stats.mtimeMs > 10 * 60 * 1000) {
                    await fs.remove(`${baseDir}/${session}`);
                    console.log(`🧹 Removed stale session: ${session}`);
                }
            } catch (e) {}
        }
    } catch (e) {}
}, 60000);

// ==================== UNCAUGHT EXCEPTIONS ====================
process.on('uncaughtException', (err) => {
    const e = String(err);
    const ignore = [
        'conflict', 'not-authorized', 'Socket connection timeout', 'rate-overlimit',
        'Connection Closed', 'Timed Out', 'Value not found', 'Stream Errored',
        'statusCode: 515', 'statusCode: 503'
    ];
    if (!ignore.some(x => e.includes(x))) {
        console.error('❌ Uncaught exception:', err);
    }
});

// ==================== PROCESS CLEANUP ====================
process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, cleaning up...');
    try {
        await fs.remove('./auth_info_baileys');
    } catch (e) {}
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, cleaning up...');
    try {
        await fs.remove('./auth_info_baileys');
    } catch (e) {}
    process.exit(0);
});

export default router;
