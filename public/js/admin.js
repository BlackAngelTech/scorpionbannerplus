/**
 * ============================================================
 * SCORPION X – ADMIN.JS
 * Admin panel logic
 * ============================================================
 */

const ADMIN_SESSION_KEY = 'adminToken';

// ==================== ADMIN LOGIN ====================
async function adminLogin() {
    const password = document.getElementById('adminPassword')?.value;
    const msgDiv = document.getElementById('loginMessage');

    if (!password) {
        if (msgDiv) {
            msgDiv.innerHTML = '❌ Please enter the admin password.';
            msgDiv.className = 'message error';
        }
        return;
    }

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await res.json();

        if (data.success && data.token) {
            sessionStorage.setItem(ADMIN_SESSION_KEY, data.token);
            document.getElementById('loginContainer').style.display = 'none';
            document.getElementById('adminContent').style.display = 'block';
            document.querySelector('.hamburger').style.display = 'flex';
            loadAdminData();
            showToast('✅ Welcome Admin', 'You have full control over SCORPION X.');
        } else {
            if (msgDiv) {
                msgDiv.innerHTML = '❌ ' + (data.message || 'Invalid password');
                msgDiv.className = 'message error';
            }
        }
    } catch (err) {
        if (msgDiv) {
            msgDiv.innerHTML = '❌ Server error. Try again.';
            msgDiv.className = 'message error';
        }
    }
}

// ==================== CHECK ADMIN SESSION ====================
function checkAdminSession() {
    const token = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (token) {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        document.querySelector('.hamburger').style.display = 'flex';
        loadAdminData();
        return true;
    } else {
        document.querySelector('.hamburger').style.display = 'none';
        return false;
    }
}

// ==================== LOAD ADMIN DATA ====================
async function loadAdminData() {
    await Promise.all([
        loadStats(),
        loadUsers(),
        loadBugs(),
        loadChannels(),
        loadGroups(),
        loadLogs(),
        loadPricing()
    ]);

    // Auto-refresh stats every 30 seconds
    if (window._statsInterval) clearInterval(window._statsInterval);
    window._statsInterval = setInterval(loadStats, 30000);

    // Auto-refresh logs every 60 seconds
    if (window._logInterval) clearInterval(window._logInterval);
    window._logInterval = setInterval(loadLogs, 60000);
}

// ==================== API HELPER ====================
async function adminApiRequest(endpoint, method = 'GET', body = null) {
    const token = sessionStorage.getItem(ADMIN_SESSION_KEY);
    try {
        const opts = {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(endpoint, opts);
        return await res.json();
    } catch (err) {
        console.error('Admin API Error:', err);
        return { success: false, message: err.message };
    }
}

// ==================== LOAD STATS ====================
async function loadStats() {
    try {
        const data = await adminApiRequest('/api/admin/stats');
        if (data.success) {
            document.getElementById('statUsers').textContent = data.totalUsers || 0;
            document.getElementById('statApproved').textContent = data.approvedUsers || 0;
            document.getElementById('statPremium').textContent = data.premiumUsers || 0;
            document.getElementById('statConnected').textContent = data.connectedDevices || 0;
            document.getElementById('statBans').textContent = data.totalBans || 0;
            document.getElementById('statCoins').textContent = data.totalCoins || 0;
            document.getElementById('statBugs').textContent = data.totalBugs || 0;
            const uptime = Math.floor(process.uptime ? process.uptime() / 3600 : 0);
            document.getElementById('statUptime').textContent = uptime + 'h';
        }
    } catch (err) {
        console.error('Error loading stats:', err);
    }
}

// ==================== LOAD USERS ====================
async function loadUsers() {
    try {
        const data = await adminApiRequest('/api/admin/users');
        if (data.success && data.users) {
            const container = document.getElementById('userList');
            container.innerHTML = data.users.map(user => `
                <div class="list-item">
                    <div class="info">
                        <div class="name">${escapeHtml(user.email)} ${user.approved ? '<span class="badge badge-approved">✓ Approved</span>' : '<span class="badge badge-pending">⏳ Pending</span>'} ${user.premium ? '<span class="badge badge-premium">PREMIUM</span>' : ''}</div>
                        <div class="desc">${user.phone || ''} • Age: ${user.age || '?'} • ${user.whatsappConnected ? '📱 Connected' : '📱 Not Connected'}</div>
                    </div>
                    <div>
                        ${!user.approved ? `<button class="btn-fire btn-sm btn-success" onclick="approveUser('${user.id}')"><i class="fas fa-check"></i></button>` : ''}
                        ${user.premium ? `<button class="btn-fire btn-sm btn-warning" onclick="togglePremium('${user.id}', false)"><i class="fas fa-crown"></i></button>` : `<button class="btn-fire btn-sm" onclick="togglePremium('${user.id}', true)"><i class="fas fa-crown"></i></button>`}
                        <button class="btn-fire btn-sm btn-danger" onclick="deleteUser('${user.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Error loading users:', err);
    }
}

// ==================== USER ACTIONS ====================
window.approveUser = async (userId) => {
    const res = await adminApiRequest('/api/admin/approve-user', 'POST', { userId });
    if (res.success) { showToast('✅ Approved', 'User approved successfully!'); loadUsers(); loadStats(); }
    else showToast('❌ Error', res.message || 'Failed');
};

window.togglePremium = async (userId, premium) => {
    const tier = premium ? 'premium' : 'lite';
    const res = await adminApiRequest('/api/admin/update-tier', 'POST', { userId, tier });
    if (res.success) { showToast('✅ Updated', `User tier updated to ${tier}`); loadUsers(); loadStats(); }
    else showToast('❌ Error', res.message || 'Failed');
};

window.deleteUser = async (userId) => {
    if (!confirm('⚠️ Delete this user permanently?')) return;
    const res = await adminApiRequest('/api/admin/delete-user', 'POST', { userId });
    if (res.success) { showToast('🗑️ Deleted', 'User deleted successfully'); loadUsers(); loadStats(); }
    else showToast('❌ Error', res.message || 'Failed');
};

// ==================== CREATE USER ====================
async function createUser() {
    const email = document.getElementById('newEmail').value.trim();
    const phone = document.getElementById('newPhone').value.trim();
    const age = parseInt(document.getElementById('newAge').value);
    const password = document.getElementById('newPassword').value;
    const msgDiv = document.getElementById('createUserMessage');

    if (!email || !phone || !age || !password) {
        msgDiv.innerHTML = '❌ All fields required';
        msgDiv.className = 'message error';
        return;
    }

    const res = await adminApiRequest('/api/admin/create-user', 'POST', { email, phone, age, password });
    if (res.success) {
        msgDiv.innerHTML = '✅ User created successfully!';
        msgDiv.className = 'message success';
        document.getElementById('newEmail').value = '';
        document.getElementById('newPhone').value = '';
        document.getElementById('newAge').value = '';
        document.getElementById('newPassword').value = '';
        loadUsers();
        loadStats();
        showToast('✅ Created', 'User created successfully');
    } else {
        msgDiv.innerHTML = '❌ ' + (res.message || 'Creation failed');
        msgDiv.className = 'message error';
    }
    setTimeout(() => msgDiv.innerHTML = '', 5000);
}

// ==================== BROADCAST ====================
async function sendBroadcast() {
    const message = document.getElementById('broadcastMessage').value.trim();
    const target = document.getElementById('broadcastTarget').value;
    const type = document.getElementById('broadcastType').value;
    const msgDiv = document.getElementById('broadcastMessageDiv');

    if (!message) {
        msgDiv.innerHTML = '❌ Message required';
        msgDiv.className = 'message error';
        return;
    }

    const res = await adminApiRequest('/api/admin/broadcast', 'POST', { message, target, type });
    if (res.success) {
        msgDiv.innerHTML = `✅ Broadcast sent to ${res.count} users`;
        msgDiv.className = 'message success';
        document.getElementById('broadcastMessage').value = '';
        showToast('📢 Broadcast', `Sent to ${res.count} users`);
    } else {
        msgDiv.innerHTML = '❌ ' + (res.message || 'Failed');
        msgDiv.className = 'message error';
    }
    setTimeout(() => msgDiv.innerHTML = '', 5000);
}

// ==================== BUG MANAGEMENT ====================
async function loadBugs() {
    try {
        const data = await adminApiRequest('/api/admin/bugs');
        if (data.success && data.bugs) {
            const container = document.getElementById('bugList');
            container.innerHTML = data.bugs.map(bug => `
                <div class="list-item">
                    <div class="info">
                        <div class="name">${escapeHtml(bug.name)} ${bug.premiumOnly ? '<span class="badge badge-premium">PREMIUM</span>' : '<span class="badge badge-free">FREE</span>'} <span class="badge" style="background:rgba(255,69,0,0.2);color:var(--fire-orange);">${bug.category || 'General'}</span></div>
                        <div class="desc">${escapeHtml(bug.description || '')}</div>
                    </div>
                    <button class="btn-fire btn-sm btn-danger" onclick="deleteBug('${bug.id}')"><i class="fas fa-trash"></i></button>
                </div>
            `).join('');
        }
    } catch (err) { console.error('Error loading bugs:', err); }
}

async function addBug() {
    const name = document.getElementById('bugName').value.trim();
    const category = document.getElementById('bugCategory').value.trim();
    const description = document.getElementById('bugDesc').value.trim();
    const targetPlaceholder = document.getElementById('bugTarget').value.trim();
    const icon = document.getElementById('bugIcon').value.trim() || 'fas fa-bug';
    const price = parseInt(document.getElementById('bugPrice').value) || 0;
    const premiumOnly = document.getElementById('bugPremium').value === 'true';
    const file = document.getElementById('bugFile').value.trim();
    const code = document.getElementById('bugCode').value.trim();
    const msgDiv = document.getElementById('bugMessage');

    if (!name || !category || !description || !code) {
        msgDiv.innerHTML = '❌ Name, category, description and code required';
        msgDiv.className = 'message error';
        return;
    }

    const res = await adminApiRequest('/api/admin/add-bug', 'POST', { name, category, description, targetPlaceholder, icon, price, premiumOnly, file, code });
    if (res.success) {
        msgDiv.innerHTML = '✅ Bug added successfully!';
        msgDiv.className = 'message success';
        document.getElementById('bugName').value = '';
        document.getElementById('bugCategory').value = '';
        document.getElementById('bugDesc').value = '';
        document.getElementById('bugTarget').value = '';
        document.getElementById('bugIcon').value = '';
        document.getElementById('bugPrice').value = '';
        document.getElementById('bugFile').value = '';
        document.getElementById('bugCode').value = '';
        loadBugs();
        loadStats();
        showToast('✅ Added', 'Bug added successfully');
    } else {
        msgDiv.innerHTML = '❌ ' + (res.message || 'Failed');
        msgDiv.className = 'message error';
    }
    setTimeout(() => msgDiv.innerHTML = '', 5000);
}

window.deleteBug = async (bugId) => {
    if (!confirm('Delete this bug?')) return;
    const res = await adminApiRequest('/api/admin/delete-bug', 'POST', { bugId });
    if (res.success) { showToast('🗑️ Deleted', 'Bug deleted'); loadBugs(); loadStats(); }
    else showToast('❌ Error', res.message || 'Failed');
};

// ==================== CHANNEL MANAGEMENT ====================
async function loadChannels() {
    try {
        const data = await adminApiRequest('/api/admin/channels');
        if (data.success && data.channels) {
            const container = document.getElementById('channelList');
            container.innerHTML = data.channels.map(ch => `
                <div class="list-item">
                    <div class="info">
                        <div class="name">📢 ${escapeHtml(ch.name)}</div>
                        <div class="desc">${escapeHtml(ch.jid)}</div>
                    </div>
                    <button class="btn-fire btn-sm btn-danger" onclick="deleteChannel('${ch.id}')"><i class="fas fa-trash"></i></button>
                </div>
            `).join('');
        }
    } catch (err) { console.error('Error loading channels:', err); }
}

async function addChannel() {
    const name = document.getElementById('channelName').value.trim();
    const jid = document.getElementById('channelJid').value.trim();
    const msgDiv = document.getElementById('channelMessage');

    if (!name || !jid) {
        msgDiv.innerHTML = '❌ Name and JID required';
        msgDiv.className = 'message error';
        return;
    }

    const res = await adminApiRequest('/api/admin/add-channel', 'POST', { name, jid });
    if (res.success) {
        msgDiv.innerHTML = '✅ Channel added!';
        msgDiv.className = 'message success';
        document.getElementById('channelName').value = '';
        document.getElementById('channelJid').value = '';
        loadChannels();
        showToast('✅ Added', 'Channel added successfully');
    } else {
        msgDiv.innerHTML = '❌ ' + (res.message || 'Failed');
        msgDiv.className = 'message error';
    }
    setTimeout(() => msgDiv.innerHTML = '', 5000);
}

window.deleteChannel = async (channelId) => {
    if (!confirm('Delete this channel?')) return;
    const res = await adminApiRequest('/api/admin/delete-channel', 'POST', { channelId });
    if (res.success) { showToast('🗑️ Deleted', 'Channel deleted'); loadChannels(); }
    else showToast('❌ Error', res.message || 'Failed');
};

// ==================== GROUP MANAGEMENT ====================
async function loadGroups() {
    try {
        const data = await adminApiRequest('/api/admin/groups');
        if (data.success && data.groups) {
            const container = document.getElementById('groupList');
            container.innerHTML = data.groups.map(g => `
                <div class="list-item">
                    <div class="info">
                        <div class="name">${escapeHtml(g.name)} ${g.premium ? '<span class="badge badge-premium">PREMIUM</span>' : ''} <span class="badge" style="background:rgba(255,255,255,0.05);color:var(--text-secondary);">${g.members || 0} members</span></div>
                    </div>
                    <button class="btn-fire btn-sm btn-danger" onclick="deleteGroup('${g.id}')"><i class="fas fa-trash"></i></button>
                </div>
            `).join('');
        }
    } catch (err) { console.error('Error loading groups:', err); }
}

async function createGroup() {
    const name = document.getElementById('groupName').value.trim();
    const premium = document.getElementById('groupType').value === 'premium';
    const msgDiv = document.getElementById('groupMessage');

    if (!name) {
        msgDiv.innerHTML = '❌ Group name required';
        msgDiv.className = 'message error';
        return;
    }

    const res = await adminApiRequest('/api/admin/create-group', 'POST', { name, premium });
    if (res.success) {
        msgDiv.innerHTML = '✅ Group created!';
        msgDiv.className = 'message success';
        document.getElementById('groupName').value = '';
        loadGroups();
        showToast('✅ Created', 'Group created successfully');
    } else {
        msgDiv.innerHTML = '❌ ' + (res.message || 'Failed');
        msgDiv.className = 'message error';
    }
    setTimeout(() => msgDiv.innerHTML = '', 5000);
}

window.deleteGroup = async (groupId) => {
    if (!confirm('Delete this group?')) return;
    const res = await adminApiRequest('/api/admin/delete-group', 'POST', { groupId });
    if (res.success) { showToast('🗑️ Deleted', 'Group deleted'); loadGroups(); }
    else showToast('❌ Error', res.message || 'Failed');
};

// ==================== PRICING ====================
async function loadPricing() {
    try {
        const data = await adminApiRequest('/api/admin/pricing');
        if (data.success) {
            document.getElementById('banCost').value = data.banCost || 10;
            document.getElementById('unbanCost').value = data.unbanCost || 5;
            document.getElementById('premiumCost').value = data.premiumCost || 11100;
            document.getElementById('referralBonus').value = data.referralBonus || 55;
            document.getElementById('dailyBonus').value = data.dailyBonus || 50;
        }
    } catch (err) { console.error('Error loading pricing:', err); }
}

async function savePricing() {
    const pricing = {
        banCost: parseInt(document.getElementById('banCost').value) || 10,
        unbanCost: parseInt(document.getElementById('unbanCost').value) || 5,
        premiumCost: parseInt(document.getElementById('premiumCost').value) || 11100,
        referralBonus: parseInt(document.getElementById('referralBonus').value) || 55,
        dailyBonus: parseInt(document.getElementById('dailyBonus').value) || 50
    };
    const res = await adminApiRequest('/api/admin/save-pricing', 'POST', pricing);
    const msgDiv = document.getElementById('pricingMessage');
    if (res.success) {
        msgDiv.innerHTML = '✅ Pricing saved!';
        msgDiv.className = 'message success';
        showToast('💾 Saved', 'Pricing settings updated');
    } else {
        msgDiv.innerHTML = '❌ ' + (res.message || 'Failed');
        msgDiv.className = 'message error';
    }
    setTimeout(() => msgDiv.innerHTML = '', 5000);
}

// ==================== LOGS ====================
async function loadLogs() {
    try {
        const data = await adminApiRequest('/api/admin/logs');
        if (data.success && data.logs) {
            const container = document.getElementById('logList');
            container.innerHTML = data.logs.map(log => `
                <div class="list-item">
                    <div class="info">
                        <div class="name">${escapeHtml(log.message || log)}</div>
                        <div class="desc">${log.time || new Date().toLocaleString()}</div>
                    </div>
                    <span class="badge" style="background:rgba(255,69,0,0.15);color:var(--text-secondary);">${log.type || 'info'}</span>
                </div>
            `).join('');
        }
    } catch (err) { console.error('Error loading logs:', err); }
}

function refreshLogs() {
    loadLogs();
    showToast('🔄 Refreshed', 'Logs updated');
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAdminSession()) {
        // Show login form
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('adminContent').style.display = 'none';
        document.querySelector('.hamburger').style.display = 'none';
    }
});

// ==================== EXPOSE GLOBALLY ====================
window.adminLogin = adminLogin;
window.loadAdminData = loadAdminData;
window.createUser = createUser;
window.sendBroadcast = sendBroadcast;
window.addBug = addBug;
window.addChannel = addChannel;
window.createGroup = createGroup;
window.savePricing = savePricing;
window.refreshLogs = refreshLogs;
