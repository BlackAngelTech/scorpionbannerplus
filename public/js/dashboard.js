/**
 * ============================================================
 * SCORPION X – DASHBOARD.JS
 * Dashboard functionality
 * ============================================================
 */

const SESSION_KEY = 'authToken';

// ==================== LOAD DASHBOARD DATA ====================
async function loadDashboard() {
    try {
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        const res = await fetch('/api/user/dashboard', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            const user = data.user;

            // Update greeting
            const usernameEl = document.getElementById('usernameDisplay');
            if (usernameEl) {
                usernameEl.textContent = user.username || user.email.split('@')[0];
            }

            // Update coins
            const coins = user.coins || 0;
            document.getElementById('coinCount').textContent = coins;
            document.getElementById('coinBalance').textContent = coins;

            // Update premium progress
            const target = 11100;
            const progress = Math.min((coins / target) * 100, 100);
            document.getElementById('premiumProgress').style.width = progress + '%';
            document.getElementById('premiumTarget').textContent = `${Math.max(target - coins, 0)} coins`;

            // Update stats
            document.getElementById('banCount').textContent = user.stats?.totalBans || 0;
            document.getElementById('unbanCount').textContent = user.stats?.totalUnbans || 0;
            document.getElementById('referralCount').textContent = user.totalReferrals || 0;

            // Update tier
            const tierEl = document.getElementById('tierDisplay');
            const tierBadge = document.getElementById('tierBadge');
            if (user.isPremium) {
                if (tierEl) { tierEl.textContent = '🔥 PREMIUM'; tierEl.style.color = 'var(--gold)'; }
                if (tierBadge) { tierBadge.textContent = 'PREMIUM'; tierBadge.className = 'badge-status online'; }
            } else {
                if (tierEl) { tierEl.textContent = '⚔ LITE'; tierEl.style.color = 'var(--text-secondary)'; }
                if (tierBadge) { tierBadge.textContent = 'LITE'; tierBadge.className = 'badge-status offline'; }
            }

            // Update announcement
            if (data.announcement) {
                document.getElementById('announcementText').textContent = data.announcement;
            }

            // Update activity feed
            if (data.activities && data.activities.length) {
                const container = document.getElementById('activityList');
                container.innerHTML = data.activities.map(act => `
                    <div class="activity-item">
                        <div class="activity-icon"><i class="${act.icon}"></i></div>
                        <div class="activity-content">
                            <h4>${act.title}</h4>
                            <p>${act.description}</p>
                        </div>
                        <span class="activity-time">${act.time}</span>
                    </div>
                `).join('');
            } else {
                document.getElementById('activityList').innerHTML = `
                    <div style="text-align:center; color:var(--text-secondary); padding:20px; font-size:0.85rem;">
                        <i class="fas fa-inbox"></i> No recent activity
                    </div>
                `;
            }

            // Update online users
            document.getElementById('onlineUsers').textContent = data.onlineUsers || 0;

            // Update status dot
            const statusDot = document.getElementById('statusDot');
            const statusText = document.getElementById('statusText');
            if (statusDot && statusText) {
                const connected = data.connected || false;
                if (connected) {
                    statusDot.className = 'dot green';
                    statusText.textContent = 'Online';
                } else {
                    statusDot.className = 'dot red';
                    statusText.textContent = 'Disconnected';
                }
            }

        } else if (data.message === 'Unauthorized') {
            localStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(SESSION_KEY);
            window.location.href = '/login.html';
        }
    } catch (err) {
        console.error('Error loading dashboard:', err);
        showToast('❌ Error', 'Failed to load dashboard data');
    }
}

// ==================== CHECK WHATSAPP STATUS ====================
async function checkWhatsAppStatus() {
    try {
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        if (!token) return;

        const res = await fetch('/api/user/device-status', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        if (statusDot && statusText) {
            if (data.connected) {
                statusDot.className = 'dot green';
                statusText.textContent = 'Online';
                statusText.style.color = '#25D366';
            } else {
                statusDot.className = 'dot red';
                statusText.textContent = 'Disconnected';
                statusText.style.color = '#ff4444';
            }
        }

        return data.connected;
    } catch (err) {
        console.error('Error checking WhatsApp status:', err);
        return false;
    }
}

// ==================== CLOSE ANNOUNCEMENT ====================
function closeAnnouncement() {
    const box = document.getElementById('announcementBox');
    if (box) box.style.display = 'none';
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    checkWhatsAppStatus();

    // Auto-refresh every 60 seconds
    setInterval(loadDashboard, 60000);

    // Check WhatsApp status every 30 seconds
    setInterval(checkWhatsAppStatus, 30000);
});

// ==================== EXPOSE GLOBALLY ====================
window.loadDashboard = loadDashboard;
window.checkWhatsAppStatus = checkWhatsAppStatus;
window.closeAnnouncement = closeAnnouncement;
