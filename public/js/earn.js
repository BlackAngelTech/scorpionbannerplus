/**
 * ============================================================
 * SCORPION X – EARN.JS
 * Coin system (daily claim, referrals, history)
 * ============================================================
 */

const SESSION_KEY = 'authToken';

// ==================== STATE ====================
let userData = null;
let claimCooldown = 0;
let claimTimerInterval = null;

// ==================== LOAD DATA ====================
async function loadEarnData() {
    await Promise.all([
        loadProfile(),
        loadReferralStats(),
        loadCoinHistory()
    ]);
}

async function loadProfile() {
    try {
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        const res = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            userData = data.user;

            // Update balance
            document.getElementById('coinBalance').textContent = userData.coins || 0;

            // Update premium status
            const isPremium = userData.isPremium || false;
            document.getElementById('premiumStatus').textContent = isPremium ? '🔥 PREMIUM' : 'LITE';
            document.getElementById('premiumStatus').style.color = isPremium ? 'var(--gold)' : 'var(--text-secondary)';

            // Update progress
            const coins = userData.coins || 0;
            const target = 11100;
            const progress = Math.min((coins / target) * 100, 100);
            document.getElementById('premiumProgress').style.width = progress + '%';
            document.getElementById('progressText').textContent = `${coins} / ${target}`;

            // Update referral code
            document.getElementById('referralCode').textContent = userData.referralCode || 'SCORPION_ABC123';
            const referralLink = `https://scorpion-x.com/register?ref=${userData.referralCode || 'SCORPION_ABC123'}`;
            document.getElementById('referralLink').textContent = referralLink;

            // Check daily claim status
            checkDailyClaimStatus();
        }
    } catch (err) {
        console.error('Error loading profile:', err);
    }
}

async function loadReferralStats() {
    try {
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        const res = await fetch('/api/referral/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('totalReferrals').textContent = data.totalReferrals || 0;
            document.getElementById('referralCoinsEarned').textContent = data.coinsEarned || 0;
            document.getElementById('pendingReferrals').textContent = data.pending || 0;
            document.getElementById('referralRank').textContent = data.rank || 0;
        }
    } catch (err) {
        console.error('Error loading referral stats:', err);
    }
}

async function loadCoinHistory() {
    try {
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        const res = await fetch('/api/coin/history', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.history && data.history.length) {
            const container = document.getElementById('historyList');
            container.innerHTML = data.history.map(item => `
                <div class="history-item">
                    <div class="icon ${item.type === 'earned' ? 'earned' : 'spent'}">
                        <i class="fas ${item.type === 'earned' ? 'fa-plus' : 'fa-minus'}"></i>
                    </div>
                    <div class="content">
                        <div class="title">${item.title}</div>
                        <div class="desc">${item.description}</div>
                    </div>
                    <div class="amount ${item.type === 'earned' ? 'positive' : 'negative'}">${item.type === 'earned' ? '+' : '-'}${item.amount}</div>
                    <div class="time">${item.time}</div>
                </div>
            `).join('');
        } else {
            document.getElementById('historyList').innerHTML = `
                <div style="text-align:center; color:var(--text-secondary); padding:20px; font-size:0.85rem;">
                    <i class="fas fa-inbox"></i> No coin history yet
                </div>
            `;
        }
    } catch (err) {
        console.error('Error loading coin history:', err);
        document.getElementById('historyList').innerHTML = `
            <div style="text-align:center; color:var(--text-secondary); padding:20px; font-size:0.85rem;">
                <i class="fas fa-exclamation-triangle"></i> Could not load history
            </div>
        `;
    }
}

// ==================== DAILY CLAIM ====================
function checkDailyClaimStatus() {
    const lastClaim = userData?.lastDailyClaim || 0;
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000; // 24 hours
    const remaining = cooldown - (now - lastClaim);

    const claimBtn = document.getElementById('claimBtn');
    const claimTimer = document.getElementById('claimTimer');

    if (remaining <= 0) {
        if (claimBtn) {
            claimBtn.disabled = false;
            claimBtn.innerHTML = '<i class="fas fa-coins"></i> Claim Now';
            claimBtn.className = 'claim-btn';
        }
        if (claimTimer) claimTimer.textContent = '✅ Ready to claim!';
    } else {
        if (claimBtn) {
            claimBtn.disabled = true;
            claimBtn.innerHTML = '<i class="fas fa-clock"></i> Claim';
            claimBtn.className = 'claim-btn claimed';
        }
        if (claimTimer) {
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            claimTimer.textContent = `⏳ Available in ${hours}h ${minutes}m`;
        }
        claimCooldown = remaining;
        startClaimTimer();
    }
}

function startClaimTimer() {
    if (claimTimerInterval) clearInterval(claimTimerInterval);
    claimTimerInterval = setInterval(() => {
        claimCooldown -= 1000;
        if (claimCooldown <= 0) {
            clearInterval(claimTimerInterval);
            claimTimerInterval = null;
            checkDailyClaimStatus();
        } else {
            const hours = Math.floor(claimCooldown / (1000 * 60 * 60));
            const minutes = Math.floor((claimCooldown % (1000 * 60 * 60)) / (1000 * 60));
            const timer = document.getElementById('claimTimer');
            if (timer) timer.textContent = `⏳ Available in ${hours}h ${minutes}m`;
        }
    }, 1000);
}

async function claimDaily() {
    try {
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        const btn = document.getElementById('claimBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Claiming...';

        const res = await fetch('/api/claim-daily', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            showToast('✅ Claimed!', `+${data.amount} coins claimed!`);
            loadEarnData();
        } else {
            showToast('❌ Error', data.message || 'Claim failed');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-coins"></i> Claim Now';
        }
    } catch (err) {
        console.error('Error claiming daily:', err);
        showToast('❌ Error', 'Server error. Try again.');
        const btn = document.getElementById('claimBtn');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-coins"></i> Claim Now';
    }
}

// ==================== REFERRAL ====================
function copyReferralCode() {
    const code = document.getElementById('referralCode')?.textContent;
    if (code) copyToClipboard(code);
}

function copyReferralLink() {
    const link = document.getElementById('referralLink')?.textContent;
    if (link) copyToClipboard(link);
}

// ==================== SHARE ====================
function shareWhatsApp() {
    const link = document.getElementById('referralLink')?.textContent;
    if (link) {
        const text = `🔥 Join SCORPION X using my referral link: ${link}`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    }
}

function shareTwitter() {
    const link = document.getElementById('referralLink')?.textContent;
    if (link) {
        const text = `🔥 Join SCORPION X using my referral link: ${link}`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    }
}

function shareFacebook() {
    const link = document.getElementById('referralLink')?.textContent;
    if (link) {
        const text = `🔥 Join SCORPION X using my referral link: ${link}`;
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(text)}`, '_blank');
    }
}

function shareTelegram() {
    const link = document.getElementById('referralLink')?.textContent;
    if (link) {
        const text = `🔥 Join SCORPION X using my referral link: ${link}`;
        window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`, '_blank');
    }
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', loadEarnData);

// ==================== EXPOSE GLOBALLY ====================
window.claimDaily = claimDaily;
window.copyReferralCode = copyReferralCode;
window.copyReferralLink = copyReferralLink;
window.shareWhatsApp = shareWhatsApp;
window.shareTwitter = shareTwitter;
window.shareFacebook = shareFacebook;
window.shareTelegram = shareTelegram;
window.loadEarnData = loadEarnData;
