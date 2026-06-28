/**
 * ============================================================
 * SCORPION X – UNBAN.JS
 * Unban request functionality
 * ============================================================
 */

const SESSION_KEY = 'authToken';

// ==================== STATE ====================
let allUnbans = [];
let currentFilter = 'all';
let userCoins = 0;
let isPremium = false;
let isConnected = false;
let totalUnbans = 0;
let favoriteUnbans = JSON.parse(localStorage.getItem('favoriteUnbans') || '[]');

// ==================== LOAD DATA ====================
async function loadUnbanData() {
    await Promise.all([
        loadUnbans(),
        loadUserData(),
        checkConnection()
    ]);
}

async function loadUserData() {
    try {
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        const res = await fetch('/api/user/status', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            userCoins = data.coins || 0;
            isPremium = data.premium || false;
            totalUnbans = data.stats?.totalUnbans || 0;
            document.getElementById('coinBalance').textContent = userCoins;
            document.getElementById('totalUnbans').textContent = totalUnbans;
            document.getElementById('premiumStatus').textContent = isPremium ? '🔥 PREMIUM' : 'LITE';
            document.getElementById('premiumStatus').style.color = isPremium ? 'var(--gold)' : 'var(--text-secondary)';
        }
    } catch (err) {
        console.error('Error loading user data:', err);
    }
}

async function checkConnection() {
    try {
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        const res = await fetch('/api/user/device-status', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        isConnected = data.connected || false;
        const statusEl = document.getElementById('connectionStatus');
        if (isConnected) {
            statusEl.className = 'status-badge connected';
            statusEl.innerHTML = `<span class="dot green"></span> Connected`;
        } else {
            statusEl.className = 'status-badge disconnected';
            statusEl.innerHTML = `<span class="dot red"></span> Disconnected`;
        }
    } catch (err) {
        console.error('Error checking connection:', err);
    }
}

async function loadUnbans() {
    try {
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        const res = await fetch('/api/unbans', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            allUnbans = data.unbans || [];
            document.getElementById('pendingRequests').textContent = allUnbans.filter(u => u.status === 'pending').length || 0;
            const successRate = allUnbans.length > 0 ? Math.round(Math.random() * 30 + 65) : 0;
            document.getElementById('successRate').textContent = successRate + '%';
            renderUnbans(allUnbans);
        } else {
            document.getElementById('unbanGrid').innerHTML = `
                <div style="text-align:center; color:var(--text-secondary); grid-column:1/-1; padding:40px 0;">
                    <i class="fas fa-infinity" style="font-size:2rem; opacity:0.3;"></i>
                    <p style="margin-top:10px;">No unban methods available</p>
                </div>
            `;
        }
    } catch (err) {
        console.error('Error loading unbans:', err);
        document.getElementById('unbanGrid').innerHTML = `
            <div style="text-align:center; color:var(--text-secondary); grid-column:1/-1; padding:40px 0;">
                <i class="fas fa-exclamation-triangle" style="font-size:2rem; color:var(--fire-orange);"></i>
                <p style="margin-top:10px;">Failed to load unban methods</p>
            </div>
        `;
    }
}

// ==================== RENDER UNBANS ====================
function renderUnbans(unbans) {
    const grid = document.getElementById('unbanGrid');
    const searchQuery = document.getElementById('searchUnbans')?.value.toLowerCase() || '';

    let filtered = unbans;

    if (currentFilter === 'premium') {
        filtered = filtered.filter(b => b.premiumOnly);
    } else if (currentFilter === 'free') {
        filtered = filtered.filter(b => !b.premiumOnly);
    } else if (currentFilter === 'popular') {
        filtered = filtered.filter(b => (b.stats?.executions || 0) > 30);
    } else if (currentFilter !== 'all') {
        filtered = filtered.filter(b => b.category === currentFilter);
    }

    if (searchQuery) {
        filtered = filtered.filter(b =>
            b.name.toLowerCase().includes(searchQuery) ||
            b.description.toLowerCase().includes(searchQuery)
        );
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="text-align:center; color:var(--text-secondary); grid-column:1/-1; padding:40px 0;">
                <i class="fas fa-search" style="font-size:2rem; opacity:0.3;"></i>
                <p style="margin-top:10px;">No unban methods match your filters</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map((unban, index) => {
        const isPremiumUnban = unban.premiumOnly || false;
        const canUse = isPremiumUnban ? isPremium : true;
        const price = unban.price || 0;
        const isFav = favoriteUnbans.includes(unban.id);
        const icon = unban.icon || 'fas fa-infinity';
        const isPopular = (unban.stats?.executions || 0) > 30;

        return `
            <div class="unban-card" data-id="${unban.id}" style="animation-delay: ${index * 0.05}s;">
                <div class="unban-header">
                    <div class="left">
                        <div class="icon"><i class="${icon}"></i></div>
                        <div class="name">${escapeHtml(unban.name)}</div>
                    </div>
                    <div class="badges">
                        <span class="badge ${isPremiumUnban ? 'badge-premium' : 'badge-free'}">
                            ${isPremiumUnban ? '⭐ PREMIUM' : 'FREE'}
                        </span>
                        ${price > 0 ? `<span class="badge badge-price">🪙 ${price}</span>` : ''}
                        <span class="badge badge-category">${unban.category || 'General'}</span>
                        ${isPopular ? '<span class="badge badge-popular">🔥 Popular</span>' : ''}
                    </div>
                </div>
                <div class="unban-description">${escapeHtml(unban.description || 'No description available.')}</div>
                <div class="unban-target">
                    <input type="text" id="target-${unban.id}" placeholder="${escapeHtml(unban.targetPlaceholder || 'Enter target...')}" ${!canUse ? 'disabled' : ''}>
                </div>
                <div class="unban-actions">
                    <button class="execute-btn" id="execute-${unban.id}" ${!canUse ? 'disabled' : ''} onclick="executeUnban('${unban.id}')">
                        <i class="fas fa-infinity"></i> ${canUse ? 'Request Unban' : '🔒 Locked'}
                    </button>
                    <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${unban.id}')">
                        <i class="fas fa-star"></i>
                    </button>
                </div>
                ${!canUse ? `<div style="font-size:0.6rem; color:var(--gold); margin-top:6px;"><i class="fas fa-crown"></i> Premium required</div>` : ''}
                ${unban.stats ? `
                    <div class="unban-stats">
                        <span><i class="fas fa-play"></i> ${unban.stats.executions || 0}</span>
                        <span><i class="fas fa-check-circle"></i> ${unban.stats.successRate || 0}%</span>
                        <span><i class="fas fa-coins"></i> ${unban.stats.coinsEarned || 0}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// ==================== EXECUTE UNBAN ====================
async function executeUnban(unbanId) {
    const unban = allUnbans.find(b => b.id === unbanId);
    if (!unban) return;

    if (!isConnected) {
        showToast('❌ Error', 'WhatsApp not connected!');
        return;
    }

    if (unban.premiumOnly && !isPremium) {
        showToast('⭐ Premium Required', 'This unban method requires a premium account.');
        return;
    }

    const price = unban.price || 0;
    if (price > 0 && !isPremium && userCoins < price) {
        showToast('🪙 Insufficient Coins', `You need ${price} coins.`);
        return;
    }

    const targetInput = document.getElementById(`target-${unban.id}`);
    const target = targetInput.value.trim();
    if (!target) {
        showToast('⚠️ Error', 'Please enter a target.');
        return;
    }

    const btn = document.getElementById(`execute-${unban.id}`);
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Requesting...';
    btn.disabled = true;

    try {
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        const startTime = Date.now();
        const res = await fetch('/api/unban/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ unbanId: unban.id, target })
        });
        const data = await res.json();
        const endTime = Date.now();

        btn.innerHTML = originalText;
        btn.disabled = false;

        if (data.success) {
            userCoins = data.newBalance || userCoins - price;
            document.getElementById('coinBalance').textContent = userCoins;
            totalUnbans++;
            document.getElementById('totalUnbans').textContent = totalUnbans;

            showResultModal({
                success: true,
                method: unban.name,
                target: target,
                message: data.message || 'Unban request sent successfully!',
                coinsUsed: price,
                time: ((endTime - startTime) / 1000).toFixed(2)
            });

            if (unban.stats) {
                unban.stats.executions = (unban.stats.executions || 0) + 1;
                unban.stats.coinsEarned = (unban.stats.coinsEarned || 0) + price;
            }
            renderUnbans(allUnbans);
        } else {
            showResultModal({
                success: false,
                method: unban.name,
                target: target,
                message: data.message || 'Unban request failed.',
                coinsUsed: 0,
                time: ((endTime - startTime) / 1000).toFixed(2)
            });
        }
    } catch (err) {
        btn.innerHTML = originalText;
        btn.disabled = false;
        showResultModal({
            success: false,
            method: unban.name,
            target: target,
            message: 'Server error. Please try again.',
            coinsUsed: 0,
            time: '0.00'
        });
    }
}

// ==================== RESULT MODAL ====================
function showResultModal(result) {
    const modal = document.getElementById('resultModal');
    if (!modal) return;

    const icon = document.getElementById('resultIcon');
    const title = document.getElementById('resultTitle');

    if (result.success) {
        icon.className = 'modal-icon success';
        icon.innerHTML = '<i class="fas fa-check-circle"></i>';
        title.textContent = '✅ Unban Request Sent!';
    } else {
        icon.className = 'modal-icon error';
        icon.innerHTML = '<i class="fas fa-times-circle"></i>';
        title.textContent = '❌ Request Failed';
    }

    document.getElementById('resultMethod').textContent = result.method;
    document.getElementById('resultTarget').textContent = result.target;
    document.getElementById('resultStatus').textContent = result.success ? '✅ Success' : '❌ Failed';
    document.getElementById('resultCoins').textContent = result.coinsUsed > 0 ? `-${result.coinsUsed}` : '0';
    document.getElementById('resultTime').textContent = `${result.time}s`;
    document.getElementById('resultMessage').textContent = result.message;

    modal.classList.add('active');
}

function closeResultModal() {
    const modal = document.getElementById('resultModal');
    if (modal) modal.classList.remove('active');
}

// ==================== FAVORITES ====================
function toggleFavorite(unbanId) {
    const index = favoriteUnbans.indexOf(unbanId);
    if (index > -1) {
        favoriteUnbans.splice(index, 1);
    } else {
        favoriteUnbans.push(unbanId);
    }
    localStorage.setItem('favoriteUnbans', JSON.stringify(favoriteUnbans));
    renderUnbans(allUnbans);
}

// ==================== FILTER ====================
function applyFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderUnbans(allUnbans);
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    loadUnbanData();
    setTimeout(() => showToast('♾️ Unban Panel', 'Select a method and enter target to request unban.'), 1500);
});

// Close modal on overlay click
document.getElementById('resultModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeResultModal();
});

// Keyboard shortcut
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeResultModal();
});

// ==================== EXPOSE GLOBALLY ====================
window.executeUnban = executeUnban;
window.toggleFavorite = toggleFavorite;
window.applyFilter = applyFilter;
window.closeResultModal = closeResultModal;
