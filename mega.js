/**
 * ============================================================
 * SCORPION X – MEGA.JS
 * Mega.nz file upload and download integration
 * ============================================================
 */

import * as mega from 'megajs';
import { Readable } from 'stream';
import dotenv from 'dotenv';

dotenv.config();

// ==================== CONFIGURATION ====================
// Use environment variables for security
const MEGA_EMAIL = process.env.MEGA_EMAIL || 'queenalphatech123@gmail.com';
const MEGA_PASSWORD = process.env.MEGA_PASSWORD || 'Ethan12??[]!';

// ==================== AUTHENTICATION ====================
const auth = {
    email: MEGA_EMAIL,
    password: MEGA_PASSWORD,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246'
};

// ==================== CACHE ====================
const uploadCache = new Map();
const downloadCache = new Map();
const CACHE_TTL = 3600000; // 1 hour

// ==================== HELPER FUNCTIONS ====================

/**
 * Get a Mega storage instance
 */
function getStorage() {
    return new Promise((resolve, reject) => {
        try {
            const storage = new mega.Storage(auth, () => {
                resolve(storage);
            });
            storage.on('error', (error) => {
                reject(error);
            });
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Upload a file to Mega.nz
 * @param {Buffer|Stream} data - File data to upload
 * @param {string} name - File name
 * @param {Object} options - Upload options
 * @returns {Promise<string>} File URL
 */
export const upload = (data, name, options = {}) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Generate cache key
            const cacheKey = `${name}_${Date.now()}`;

            // Check cache
            if (uploadCache.has(cacheKey)) {
                const cached = uploadCache.get(cacheKey);
                if (Date.now() - cached.timestamp < CACHE_TTL) {
                    console.log(`📦 Using cached upload for ${name}`);
                    resolve(cached.url);
                    return;
                }
                uploadCache.delete(cacheKey);
            }

            // Get storage
            const storage = await getStorage();

            // Convert data to stream if buffer
            let stream = data;
            if (Buffer.isBuffer(data)) {
                stream = Readable.from(data);
            }

            // Upload
            const uploadStream = storage.upload({
                name: name,
                allowUploadBuffering: true,
                ...options
            });

            // Pipe data to upload stream
            stream.pipe(uploadStream);

            // Handle upload completion
            storage.on('add', (file) => {
                file.link((err, url) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    // Cache the URL
                    uploadCache.set(cacheKey, {
                        url: url,
                        timestamp: Date.now()
                    });
                    storage.close();
                    console.log(`✅ File uploaded to Mega: ${name}`);
                    resolve(url);
                });
            });

            storage.on('error', (error) => {
                reject(error);
            });

        } catch (err) {
            console.error('❌ Mega upload error:', err.message);
            reject(err);
        }
    });
};

/**
 * Upload a file with progress tracking
 * @param {Buffer|Stream} data - File data
 * @param {string} name - File name
 * @param {Function} onProgress - Progress callback (loaded, total)
 * @returns {Promise<string>} File URL
 */
export const uploadWithProgress = (data, name, onProgress) => {
    return new Promise(async (resolve, reject) => {
        try {
            const storage = await getStorage();

            let stream = data;
            if (Buffer.isBuffer(data)) {
                stream = Readable.from(data);
            }

            const uploadStream = storage.upload({
                name: name,
                allowUploadBuffering: true
            });

            // Track progress
            let loaded = 0;
            const total = Buffer.isBuffer(data) ? data.length : 0;

            uploadStream.on('data', (chunk) => {
                loaded += chunk.length;
                if (onProgress && total > 0) {
                    onProgress(loaded, total);
                }
            });

            stream.pipe(uploadStream);

            storage.on('add', (file) => {
                file.link((err, url) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    storage.close();
                    console.log(`✅ File uploaded with progress: ${name}`);
                    resolve(url);
                });
            });

            storage.on('error', (error) => {
                reject(error);
            });

        } catch (err) {
            console.error('❌ Mega upload with progress error:', err.message);
            reject(err);
        }
    });
};

/**
 * Download a file from Mega.nz
 * @param {string} url - Mega file URL
 * @returns {Promise<Buffer>} File buffer
 */
export const download = (url) => {
    return new Promise((resolve, reject) => {
        try {
            // Check cache
            if (downloadCache.has(url)) {
                const cached = downloadCache.get(url);
                if (Date.now() - cached.timestamp < CACHE_TTL) {
                    console.log(`📦 Using cached download for ${url}`);
                    resolve(cached.buffer);
                    return;
                }
                downloadCache.delete(url);
            }

            // Get file from URL
            const file = mega.File.fromURL(url);

            file.loadAttributes((err) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Download buffer
                file.downloadBuffer((err, buffer) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // Cache the buffer
                    downloadCache.set(url, {
                        buffer: buffer,
                        timestamp: Date.now()
                    });

                    console.log(`✅ File downloaded from Mega: ${url}`);
                    resolve(buffer);
                });
            });

        } catch (err) {
            console.error('❌ Mega download error:', err.message);
            reject(err);
        }
    });
};

/**
 * Download a file as a stream
 * @param {string} url - Mega file URL
 * @returns {Promise<Stream>} File stream
 */
export const downloadStream = (url) => {
    return new Promise((resolve, reject) => {
        try {
            const file = mega.File.fromURL(url);

            file.loadAttributes((err) => {
                if (err) {
                    reject(err);
                    return;
                }

                const stream = file.download();
                console.log(`✅ File stream created from Mega: ${url}`);
                resolve(stream);
            });

        } catch (err) {
            console.error('❌ Mega download stream error:', err.message);
            reject(err);
        }
    });
};

/**
 * Get file info from Mega.nz
 * @param {string} url - Mega file URL
 * @returns {Promise<Object>} File info
 */
export const getFileInfo = (url) => {
    return new Promise((resolve, reject) => {
        try {
            const file = mega.File.fromURL(url);

            file.loadAttributes((err) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    key: file.key,
                    timestamp: file.timestamp
                });
            });

        } catch (err) {
            console.error('❌ Mega file info error:', err.message);
            reject(err);
        }
    });
};

/**
 * Delete a file from Mega.nz
 * @param {string} url - Mega file URL
 * @returns {Promise<boolean>} Success status
 */
export const deleteFile = (url) => {
    return new Promise(async (resolve, reject) => {
        try {
            const storage = await getStorage();
            const file = mega.File.fromURL(url);

            file.loadAttributes((err) => {
                if (err) {
                    reject(err);
                    return;
                }

                storage.delete([file], (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    console.log(`✅ File deleted from Mega: ${url}`);
                    storage.close();
                    resolve(true);
                });
            });

        } catch (err) {
            console.error('❌ Mega delete error:', err.message);
            reject(err);
        }
    });
};

/**
 * List files in a Mega folder
 * @param {string} folderUrl - Mega folder URL
 * @returns {Promise<Array>} List of files
 */
export const listFiles = (folderUrl) => {
    return new Promise(async (resolve, reject) => {
        try {
            const storage = await getStorage();

            storage.root.children((err, children) => {
                if (err) {
                    reject(err);
                    return;
                }

                const files = children.map(child => ({
                    name: child.name,
                    size: child.size,
                    type: child.type,
                    url: child.link
                }));

                storage.close();
                console.log(`✅ Listed ${files.length} files from Mega`);
                resolve(files);
            });

        } catch (err) {
            console.error('❌ Mega list files error:', err.message);
            reject(err);
        }
    });
};

/**
 * Clear the upload cache
 */
export const clearCache = () => {
    uploadCache.clear();
    downloadCache.clear();
    console.log('🧹 Mega cache cleared');
};

/**
 * Get cache stats
 */
export const getCacheStats = () => {
    return {
        uploadCacheSize: uploadCache.size,
        downloadCacheSize: downloadCache.size,
        totalCached: uploadCache.size + downloadCache.size
    };
};

// ==================== EXPRESS ROUTES (Optional) ====================
/**
 * Create Express routes for Mega operations
 * @param {Object} app - Express app
 */
export const createMegaRoutes = (app) => {
    import('express').then((express) => {
        const router = express.Router();

        // Upload endpoint
        router.post('/upload', async (req, res) => {
            try {
                const { data, name } = req.body;
                if (!data || !name) {
                    return res.status(400).json({ error: 'Data and name required' });
                }
                const buffer = Buffer.from(data, 'base64');
                const url = await upload(buffer, name);
                res.json({ success: true, url });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // Download endpoint
        router.get('/download', async (req, res) => {
            try {
                const { url } = req.query;
                if (!url) {
                    return res.status(400).json({ error: 'URL required' });
                }
                const buffer = await download(url);
                res.json({ success: true, data: buffer.toString('base64') });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // Info endpoint
        router.get('/info', async (req, res) => {
            try {
                const { url } = req.query;
                if (!url) {
                    return res.status(400).json({ error: 'URL required' });
                }
                const info = await getFileInfo(url);
                res.json({ success: true, info });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // Delete endpoint
        router.delete('/delete', async (req, res) => {
            try {
                const { url } = req.body;
                if (!url) {
                    return res.status(400).json({ error: 'URL required' });
                }
                await deleteFile(url);
                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.use('/api/mega', router);
        console.log('🌐 Mega routes mounted at /api/mega');
    });
};

// ==================== EXPORTS ====================
export default {
    upload,
    uploadWithProgress,
    download,
    downloadStream,
    getFileInfo,
    deleteFile,
    listFiles,
    clearCache,
    getCacheStats,
    createMegaRoutes
};
