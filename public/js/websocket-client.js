/**
 * ============================================================
 * SCORPION X – WEBSOCKET-CLIENT.JS
 * WebSocket client for real-time features
 * ============================================================
 */

class WebSocketClient {
    constructor(url, options = {}) {
        this.url = url;
        this.options = options;
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
        this.reconnectDelay = options.reconnectDelay || 3000;
        this.listeners = {};
        this.isConnecting = false;
        this.isConnected = false;
    }

    connect() {
        if (this.isConnecting || this.isConnected) return;

        this.isConnecting = true;

        try {
            // Try to get token from localStorage/sessionStorage
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

            let url = this.url;
            if (token) {
                url += (url.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`;
            }

            this.socket = new WebSocket(url);

            this.socket.onopen = () => {
                console.log('🔌 WebSocket connected');
                this.isConnected = true;
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.emit('connected');
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (e) {
                    console.error('WebSocket message parse error:', e);
                }
            };

            this.socket.onclose = (event) => {
                console.log('🔌 WebSocket disconnected');
                this.isConnected = false;
                this.isConnecting = false;
                this.emit('disconnected', event);
                this.scheduleReconnect();
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.emit('error', error);
            };

        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('⚠️ Max reconnect attempts reached');
            this.emit('reconnect_failed');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);

        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

        setTimeout(() => {
            this.connect();
        }, delay);
    }

    handleMessage(data) {
        // Handle ping/pong
        if (data.type === 'ping') {
            this.send({ type: 'pong' });
            return;
        }

        // Emit to listeners
        const type = data.type || data.event || 'message';
        this.emit(type, data);
    }

    send(data) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket not connected, message queued');
            return false;
        }

        try {
            this.socket.send(JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('WebSocket send error:', error);
            return false;
        }
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        return this;
    }

    off(event, callback) {
        if (!this.listeners[event]) return this;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        return this;
    }

    emit(event, data) {
        if (!this.listeners[event]) return;
        for (const callback of this.listeners[event]) {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in ${event} listener:`, error);
            }
        }
    }

    disconnect() {
        this.reconnectAttempts = this.maxReconnectAttempts;
        if (this.socket) {
            this.socket.close();
        }
    }

    get isReady() {
        return this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN;
    }
}

// ==================== CREATE INSTANCE ====================
function createWebSocketClient(url) {
    const client = new WebSocketClient(url || '/ws');
    client.connect();
    return client;
}

// ==================== EXPOSE GLOBALLY ====================
window.WebSocketClient = WebSocketClient;
window.createWebSocketClient = createWebSocketClient;
