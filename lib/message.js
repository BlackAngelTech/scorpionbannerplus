/**
 * ============================================================
 * SCORPION X – MESSAGE.JS
 * Sends WhatsApp session messages with buttons and channel auto-follow
 * ============================================================
 */

import https from 'https';

// ==================== CONFIGURATION ====================
const BOT_NAME = '🔥 SCORPION X';
const BOT_REPO = 'https://github.com/yourusername/scorpion-x';
const WHATSAPP_CHANNEL = 'https://whatsapp.com/channel/0029VbD1fqe5kg6xDhBs5G3M';
const BANNER_URL = 'https://files.catbox.moe/a1i7kj.png';
const NEWSLETTER_JID = '120363407756240466@newsletter';

// ==================== FETCH BUFFER ====================
function fetchBuffer(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

// ==================== SEND SESSION MESSAGE ====================
export async function sendSessionMessage(sock, jid, sessionId) {
    try {
        // Download banner
        const bannerBuffer = await fetchBuffer(BANNER_URL);

        await sock.sendMessage(jid, {
            image: bannerBuffer,
            caption: `🔥 *SCORPION X SESSION* 🔥\n\n` +
                     `*Session ID:*\n\`${sessionId}\`\n\n` +
                     `*Instructions:*\n` +
                     `1. Copy the session ID above\n` +
                     `2. Go to SCORPION X Dashboard\n` +
                     `3. Paste to restore your session\n\n` +
                     `*💀 "GET OVER HERE!"*`,

            footer: `Powered by ZENTRIX TECH`,

            // Interactive buttons
            nativeFlow: [
                { text: '📋 COPY SESSION', copy: sessionId },
                { text: '📦 REPO', url: BOT_REPO },
                { text: '📢 CHANNEL', url: WHATSAPP_CHANNEL }
            ],

            // External Ad Reply
            externalAdReply: {
                title: BOT_NAME,
                body: 'WhatsApp · Verified',
                url: WHATSAPP_CHANNEL,
                thumbnail: bannerBuffer,
                mediaType: 1,
                showAdAttribution: true,
                renderLargerThumbnail: false
            },

            // Context Info (Newsletter badge)
            contextInfo: {
                forwardedNewsletterMessageInfo: {
                    newsletterJid: NEWSLETTER_JID,
                    newsletterName: BOT_NAME,
                    serverMessageId: Math.floor(Math.random() * 999999)
                },
                isForwarded: true,
                forwardingScore: 999
            }
        });

        console.log(`✅ Session message sent to ${jid}`);

        // ==================== AUTO-FOLLOW CHANNEL ====================
        try {
            if (typeof sock.newsletterFollow === 'function') {
                await sock.newsletterFollow(NEWSLETTER_JID);
                console.log(`✅ Auto-followed newsletter for ${jid}`);
            } else if (typeof sock.followNewsletter === 'function') {
                await sock.followNewsletter(NEWSLETTER_JID);
                console.log(`✅ Auto-followed newsletter (followNewsletter) for ${jid}`);
            } else {
                console.log(`⚠️ Newsletter follow function not available for ${jid}`);
            }
        } catch (err) {
            console.log(`⚠️ Auto-follow channel error for ${jid}:`, err.message);
        }

    } catch (error) {
        console.error('❌ Error sending session message:', error.message);
        throw error;
    }
}

// ==================== SEND TEST MESSAGE ====================
export async function sendTestMessage(sock, jid) {
    try {
        await sock.sendMessage(jid, {
            text: `🔥 *SCORPION X* 🔥\n\n` +
                  `💀 *"GET OVER HERE!"*\n\n` +
                  `Your WhatsApp is now connected to SCORPION X.\n` +
                  `Visit the dashboard to start dominating.`
        });
        console.log(`✅ Test message sent to ${jid}`);
    } catch (error) {
        console.error('❌ Error sending test message:', error.message);
    }
}

// ==================== SEND PAIRING CODE MESSAGE ====================
export async function sendPairingCodeMessage(sock, jid, code) {
    try {
        await sock.sendMessage(jid, {
            text: `🔥 *SCORPION X PAIRING* 🔥\n\n` +
                  `*Your Pairing Code:*\n\`${code}\`\n\n` +
                  `1. Open WhatsApp\n` +
                  `2. Go to Settings → Linked Devices\n` +
                  `3. Tap "Link a Device"\n` +
                  `4. Enter this code\n\n` +
                  `💀 *"GET OVER HERE!"*`
        });
        console.log(`✅ Pairing code sent to ${jid}`);
    } catch (error) {
        console.error('❌ Error sending pairing code:', error.message);
    }
}

// ==================== EXPORTS ====================
export default {
    sendSessionMessage,
    sendTestMessage,
    sendPairingCodeMessage
};
