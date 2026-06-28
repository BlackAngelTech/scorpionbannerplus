/**
 * ============================================================
 * SCORPION X – CONNECT.JS
 * WhatsApp pairing functionality
 * ============================================================
 */

const SESSION_KEY = 'authToken';

// ==================== REQUEST PAIRING ====================
async function requestPairing() {
    const phoneInput = document.getElementById('phoneNumber');
    const btn = document.getElementById('connectBtn');
    const loading = document.getElementById('loadingState');
    const codeDisplay = document.getElementById('codeDisplay');
    const msgDiv = document.getElementById('connectMessage');

    if (!phoneInput || !btn || !loading || !codeDisplay) return;

    const phoneNumber = phoneInput.value.trim();

    if (!phoneNumber) {
        showMessage(msgDiv, '❌ Please enter your WhatsApp number.', 'error');
        return;
    }

    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 10) {
        showMessage(msgDiv, '❌ Invalid number. Use digits only (10-15 digits).', 'error');
        return;
    }

    btn.disabled = true;
    btn.style.display = 'none';
    loading.style.display = 'block';
    codeDisplay.classList.remove('active');
    showMessage(msgDiv, '⏳ Requesting pairing code...', 'info');

    try {
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        const res = await fetch(`/code?number=${cleanNumber}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.code) {
            document.getElementById('pairingCode').textContent = data.code;
            codeDisplay.classList.add('active');
            showMessage(msgDiv, '✅ Pairing code generated! Open WhatsApp and enter this code.', 'success');
            showToast('📱 Code Generated', 'Enter this code in WhatsApp to link your device.');

            // Auto-follow channel
            await autoFollowChannel();

            // Start polling for connection status
            if (window._pairingInterval) clearInterval(window._pairingInterval);
            window._pairingInterval = setInterval(async () => {
                const connected = await checkConnectionStatus();
                if (connected) {
                    clearInterval(window._pairingInterval);
                    window._pairingInterval = null;
                }
            }, 3000);

        } else if (data.error) {
            showMessage(msgDiv, `❌ ${data.error}`, 'error');
            showToast('❌ Error', data.error);
        } else {
            showMessage(msgDiv, '❌ Failed to get pairing code. Try again.', 'error');
        }
    } catch (err) {
        console.error('Pairing error:', err);
        showMessage(msgDiv, '❌ Server error. Please try again later.', 'error');
    }

    btn.disabled = false;
    btn.style.display = 'block';
    loading.style.display = 'none';
}

// ==================== CHECK CONNECTION STATUS ====================
async function checkConnectionStatus() {
    try {
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        const res = await fetch('/api/user/device-status', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const statusEl = document.getElementById('connectionStatus');
        const dot = document.getElementById('statusDot');
        const text = document.getElementById('statusText');

        if (data.connected) {
            if (statusEl) {
                statusEl.className = 'status-badge connected';
                statusEl.innerHTML = `<span class="dot green"></span> Connected`;
            }
            if (dot) dot.className = 'dot green';
            if (text) {
                text.textContent = 'Connected';
                text.style.color = '#25D366';
            }
            return true;
        } else {
            if (statusEl) {
                statusEl.className = 'status-badge disconnected';
                statusEl.innerHTML = `<span class="dot red"></span> Disconnected`;
            }
            if (dot) dot.className = 'dot red';
            if (text) {
                text.textContent = 'Disconnected';
                text.style.color = '#ff4444';
            }
            return false;
        }
    } catch (err) {
        console.error('Error checking connection:', err);
        return false;
    }
}

// ==================== AUTO-FOLLOW CHANNEL ====================
async function autoFollowChannel() {
    const CHANNEL_JID = '120363407756240466@newsletter';

    try {
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        const res = await fetch('/api/channel/follow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ jid: CHANNEL_JID })
        });
        const data = await res.json();
        if (data.success) {
            console.log('✅ Auto-followed channel:', CHANNEL_JID);
            const badge = document.querySelector('.channel-badge');
            if (badge) {
                badge.innerHTML = `
                    <i class="fas fa-check-circle" style="color:#25D366;"></i> Following: SCORPION X Official Channel
                `;
            }
        } else {
            console.log('⚠️ Auto-follow failed:', data.message);
        }
    } catch (err) {
        console.error('Auto-follow error:', err);
    }
}

// ==================== SHOW MESSAGE ====================
function showMessage(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'message ' + type;
    el.style.display = 'block';
    const colors = {
        error: '#ff6666',
        success: '#66ff66',
        info: 'var(--gold)'
    };
    const backgrounds = {
        error: 'rgba(255,68,68,0.1)',
        success: 'rgba(37,211,102,0.1)',
        info: 'rgba(255,215,0,0.08)'
    };
    el.style.color = colors[type] || '#fff';
    el.style.background = backgrounds[type] || 'rgba(255,255,255,0.05)';
    el.style.border = `1px solid ${colors[type] || 'rgba(255,255,255,0.1)'}40`;

    setTimeout(() => {
        if (el.textContent === msg) el.style.display = 'none';
    }, 8000);
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    checkConnectionStatus();
    // Auto-refresh status every 30 seconds
    setInterval(checkConnectionStatus, 30000);
});

// ==================== EXPOSE GLOBALLY ====================
window.requestPairing = requestPairing;
window.checkConnectionStatus = checkConnectionStatus;
window.autoFollowChannel = autoFollowChannel;
