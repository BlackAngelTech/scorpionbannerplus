import { gzipSync, gunzipSync } from 'zlib';
import { createHash, randomBytes } from 'crypto';

/**
 * ============================================================
 * SCORPION X – SESSION.JS
 * Handles session encoding/decoding and unique ID generation
 * ============================================================
 */

/**
 * Encodes creds.json buffer → "scorpion~<base64(gzip(creds))>"
 * This is the session format sent to WhatsApp users
 * 
 * @param {Buffer} credsBuffer - Raw creds.json buffer
 * @returns {string} Encoded session string
 */
export const encodeSession = (credsBuffer) => {
    const compressed = gzipSync(credsBuffer);
    return `scorpion~${compressed.toString('base64')}`;
};

/**
 * Decodes a session string back to Buffer
 * Reverse of encodeSession
 * 
 * @param {string} sessionString - Encoded session string
 * @returns {Buffer} Decoded creds buffer
 */
export const decodeSession = (sessionString) => {
    if (!sessionString || !sessionString.startsWith('scorpion~')) {
        throw new Error('Invalid session format');
    }
    const base64Data = sessionString.replace('scorpion~', '');
    const compressed = Buffer.from(base64Data, 'base64');
    return gunzipSync(compressed);
};

/**
 * Generates a unique referral code for users
 * Format: SCORPION_<username_part>_<random>_<id_part>
 * 
 * @param {string} userId - User ID
 * @param {string} username - User's username
 * @returns {string} Unique referral code
 */
export const generateReferralCode = (userId, username) => {
    const usernamePart = username.slice(0, 4).toUpperCase();
    const randomPart = randomBytes(3).toString('hex').toUpperCase();
    const idPart = userId.slice(-4).toUpperCase();
    return `SCORPION_${usernamePart}_${randomPart}_${idPart}`;
};

/**
 * Enhanced random ID generator.
 * Format: <alphanum:len>-<timestamp_base36>-<hex:4>
 * Example: "xK9mPq-m0hgz4-a3f1"
 * 
 * @param {number} prefixLen - Random alphanum chars at start (default 6)
 * @returns {string} Unique random ID
 */
export const randomId = (prefixLen = 6) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let prefix = '';
    for (let i = 0; i < prefixLen; i++) {
        prefix += chars[Math.floor(Math.random() * chars.length)];
    }
    const tsBase36 = Date.now().toString(36);
    const hexSuffix = createHash('sha256')
        .update(String(Math.random()))
        .digest('hex')
        .slice(0, 4);
    return `${prefix}-${tsBase36}-${hexSuffix}`;
};

/**
 * Generates a unique session ID for WhatsApp pairing
 * Format: session_<timestamp>_<random>
 * 
 * @param {string} phoneNumber - User's phone number
 * @returns {string} Unique session ID
 */
export const generateSessionId = (phoneNumber) => {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(4).toString('hex');
    return `session_${phoneNumber}_${timestamp}_${random}`;
};

/**
 * Validates if a session string is valid
 * 
 * @param {string} sessionString - Session string to validate
 * @returns {boolean} True if valid
 */
export const isValidSession = (sessionString) => {
    try {
        if (!sessionString || typeof sessionString !== 'string') return false;
        if (!sessionString.startsWith('scorpion~')) return false;
        const base64Data = sessionString.replace('scorpion~', '');
        const buffer = Buffer.from(base64Data, 'base64');
        // Check if it's valid base64
        if (buffer.toString('base64') !== base64Data) return false;
        // Try to gunzip (will throw if invalid)
        gunzipSync(buffer);
        return true;
    } catch (err) {
        return false;
    }
};
