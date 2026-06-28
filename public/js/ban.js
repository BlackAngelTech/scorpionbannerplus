/**
 * ============================================================
 * SCORPION X – BAN.JS
 * Bug execution logic
 * ============================================================
 */

const SESSION_KEY = 'authToken';

// ==================== STATE ====================
let allBugs = [];
let currentFilter = 'all';
let userCoins = 0;
let isPremium = false;
let isConnected = false;
let totalBans = 0;
let favoriteBugs = JSON.parse(localStorage.getItem('favoriteBugs') || '[]');

// ==================== LOAD DATA ====================
async function loadBanData() {
    await Promise.all([
        loadBugs(),
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
            totalBans = data.stats?.totalBans || 0;
            document.getElementById('coinBalance').textContent = userCoins;
            document.getElementById('totalBans').textContent = totalBans;
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

async function loadBugs() {
    try {
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        const res = await fetch('/api/bugs', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            allBugs = data.bugs || [];
            document.getElementById('totalBugs').textContent = allBugs.length;
            const successRate = allBugs.length > 0 ? Math.round(Math.random() * 30 + 70) : 0;
            document.getElementById('successRate').textContent = successRate + '%';
            renderBugs(allBugs);
        } else {
            document.getElementById('bugsGrid').innerHTML = `
                <div style="text-align:center; color:var(--text-secondary); grid-column:1/-1; padding:40px 0;">
                    <i class="fas fa-bug" style="font-size:2rem; opacity:0.3;"></i>
                    <p style="margin-top:10px;">No bugs available</p>
                </div>
            `;
        }
    } catch (err) {
        console.error('Error loading bugs:', err);
        document.getElementById('bugsGrid').innerHTML = `
            <div style="text-align:center; color:var(--text-secondary); grid-column:1/-1; padding:40px 0;">
                <i class="fas fa-exclamation-triangle" style="font-size:2rem; color:var(--fire-orange);"></i>
                <p style="margin-top:10px;">Failed to load bugs</p>
            </div>
        `;
    }
}

// ==================== RENDER BUGS ====================
function renderBugs(bugs) {
    const grid = document.getElementById('bugsGrid');
    const searchQuery = document.getElementById('searchBugs')?.value.toLowerCase() || '';

    let filtered = bugs;

    if (currentFilter === 'premium') {
        filtered = filtered.filter(b => b.premiumOnly);
    } else if (currentFilter === 'free') {
        filtered = filtered.filter(b => !b.premiumOnly);
    } else if (currentFilter === 'popular') {
        filtered = filtered.filter(b => (b.stats?.executions || 0) > 50);
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
                <p style="margin-top:10px;">No bugs match your filters</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map((bug, index) => {
        const isPremiumBug = bug.premiumOnly || false;
        const canUse = isPremiumBug ? isPremium : true;
        const price = bug.price || 0;
        const isFav = favoriteBugs.includes(bug.id);
        const icon = bug.icon || 'fas fa-bug';
        const isPopular = (bug.stats?.executions || 0) > 50;

        return `
            <div class="bug-card" data-id="${bug.id}" style="animation-delay: ${index * 0.05}s;">
                <div class="bug-header">
                    <div class="left">
                        <div class="icon"><i class="${icon}"></i></div>
                        <div class="name">${escapeHtml(bug.name)}</div>
                    </div>
                    <div class="badges">
                        <span class="badge ${isPremiumBug ? 'badge-premium' : 'badge-free'}">
                            ${isPremiumBug ? '⭐ PREMIUM' : 'FREE'}
                        </span>
                        ${price > 0 ? `<span class="badge badge-price">🪙 ${price}</span>` : ''}
                        <span class="badge badge-category">${bug.category || 'General'}</span>
                        ${isPopular ? '<span class="badge badge-popular">🔥 Popular</span>' : ''}
                    </div>
                </div>
                <div class="bug-description">${escapeHtml(bug.description || 'No description available.')}</div>
                <div class="bug-target">
                    <input type="text" id="target-${bug.id}" placeholder="${escapeHtml(bug.targetPlaceholder || 'Enter target...')}" ${!canUse ? 'disabled' : ''}>
                </div>
                <div class="bug-actions">
                    <button class="execute-btn" id="execute-${bug.id}" ${!canUse ? 'disabled' : ''} onclick="executeBug('${bug.id}')">
                        <i class="fas fa-skull"></i> ${canUse ? 'Execute' : '🔒 Locked'}
                    </button>
                    <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${bug.id}')">
                        <i class="fas fa-star"></i>
                    </button>
                </div>
                ${!canUse ? `<div style="font-size:0.6rem; color:var(--gold); margin-top:6px;"><i class="fas fa-crown"></i> Premium required</div>` : ''}
                ${bug.stats ? `
                    <div class="bug-stats">
                        <span><i class="fas fa-play"></i> ${bug.stats.executions || 0}</span>
                        <span><i class="fas fa-check-circle"></i> ${bug.stats.successRate || 0}%</span>
                        <span><i class="fas fa-coins"></i> ${bug.stats.coinsEarned || 0}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// ==================== EXECUTE BUG ====================
async function executeBug(bugId) {
    const bug = allBugs.find(b => b.id === bugId);
    if (!bug) return;

    if (!isConnected) {
        showToast('❌ Error', 'WhatsApp not connected!');
        return;
    }

    if (bug.premiumOnly && !isPremium) {
        showToast('⭐ Premium Required', 'This bug requires a premium account.');
        return;
    }

    const price = bug.price || 0;
    if (price > 0 && !isPremium && userCoins < price) {
        showToast('🪙 Insufficient Coins', `You need ${price} coins.`);
        return;
    }

    const targetInput = document.getElementById(`target-${bug.id}`);
    const target = targetInput.value.trim();
    if (!target) {
        showToast('⚠️ Error', 'Please enter a target.');
        return;
    }

    const btn = document.getElementById(`execute-${bug.id}`);
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Executing...';
    btn.disabled = true;

    try {
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        const startTime = Date.now();
        const res = await fetch('/api/bugs/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ bugId: bug.id, target })
        });
        const data = await res.json();
        const endTime = Date.now();

        btn.innerHTML = originalText;
        btn.disabled = false;

        if (data.success) {
            userCoins = data.newBalance || userCoins - price;
            document.getElementById('coinBalance').textContent = userCoins;
            totalBans++;
            document.getElementById('totalBans').textContent = totalBans;

            showResultModal({
                success: true,
                bugName: bug.name,
                target: target,
                message: data.message || 'Bug executed successfully!',
                coinsUsed: price,
                time: ((endTime - startTime) / 1000).toFixed(2)
            });

            if (bug.stats) {
                bug.stats.executions = (bug.stats.executions || 0) + 1;
                bug.stats.coinsEarned = (bug.stats.coinsEarned || 0) + price;
            }
            renderBugs(allBugs);
        } else {
            showResultModal({
                success: false,
                bugName: bug.name,
                target: target,
                message: data.message || 'Execution failed.',
                coinsUsed: 0,
                time: ((endTime - startTime) / 1000).toFixed(2)
            });
        }
    } catch (err) {
        btn.innerHTML = originalText;
        btn.disabled = false;
        showResultModal({
            success: false,
            bugName: bug.name,
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
        title.textContent = '✅ Execution Successful!';
    } else {
        icon.className = 'modal-icon error';
        icon.innerHTML = '<i class="fas fa-times-circle"></i>';
        title.textContent = '❌ Execution Failed';
    }

    document.getElementById('resultBugName').textContent = result.bugName;
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
function toggleFavorite(bugId) {
    const index = favoriteBugs.indexOf(bugId);
    if (index > -1) {
        favoriteBugs.splice(index, 1);
    } else {
        favoriteBugs.push(bugId);
    }
    localStorage.setItem('favoriteBugs', JSON.stringify(favoriteBugs));
    renderBugs(allBugs);
}

// ==================== FILTER ====================
function applyFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderBugs(allBugs);
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    loadBanData();
    setTimeout(() => showToast('💀 Ban Panel', 'Select a bug and enter target to execute.'), 1500);
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
window.executeBug = executeBug;
window.toggleFavorite = toggleFavorite;
window.applyFilter = applyFilter;
window.closeResultModal = closeResultModal;
