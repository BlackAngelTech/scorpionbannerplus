/**
 * ============================================================
 * SCORPION X – API.JS
 * API helper functions with authentication
 * ============================================================
 */

const SESSION_KEY = 'authToken';

// ==================== GET AUTH HEADERS ====================
function getAuthHeaders() {
    const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// ==================== GET AUTH HEADERS WITH FILE ====================
function getAuthHeadersMultipart() {
    const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    return {
        'Authorization': `Bearer ${token}`
        // Content-Type not set for multipart
    };
}

// ==================== GENERIC API REQUEST ====================
async function apiRequest(endpoint, method = 'GET', body = null, multipart = false) {
    try {
        const options = {
            method,
            headers: multipart ? getAuthHeadersMultipart() : getAuthHeaders()
        };

        if (body && !multipart) {
            options.body = JSON.stringify(body);
        } else if (body && multipart) {
            options.body = body;
        }

        const response = await fetch(endpoint, options);
        const data = await response.json();

        if (!data.success && data.message === 'Unauthorized') {
            // Session expired
            localStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(SESSION_KEY);
            window.location.href = '/login.html';
            throw new Error('Session expired');
        }

        return data;
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}

// ==================== USER API ====================
async function apiGetUserProfile() {
    return apiRequest('/api/user/profile');
}

async function apiUpdateProfile(data) {
    return apiRequest('/api/user/update-profile', 'POST', data);
}

async function apiChangePassword(data) {
    return apiRequest('/api/user/change-password', 'POST', data);
}

async function apiUploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);
    return apiRequest('/api/user/upload-avatar', 'POST', formData, true);
}

async function apiDeleteAccount() {
    return apiRequest('/api/user/delete-account', 'POST');
}

async function apiGetStatus() {
    return apiRequest('/api/user/status');
}

async function apiGetDeviceStatus() {
    return apiRequest('/api/user/device-status');
}

// ==================== BUGS API ====================
async function apiGetBugs() {
    return apiRequest('/api/bugs');
}

async function apiExecuteBug(bugId, target) {
    return apiRequest('/api/bugs/execute', 'POST', { bugId, target });
}

// ==================== UNBAN API ====================
async function apiGetUnbans() {
    return apiRequest('/api/unbans');
}

async function apiExecuteUnban(unbanId, target) {
    return apiRequest('/api/unban/execute', 'POST', { unbanId, target });
}

// ==================== COINS & REFERRALS ====================
async function apiClaimDaily() {
    return apiRequest('/api/claim-daily', 'POST');
}

async function apiGetReferralStats() {
    return apiRequest('/api/referral/stats');
}

async function apiGetCoinHistory() {
    return apiRequest('/api/coin/history');
}

// ==================== CHAT API ====================
async function apiGetChats() {
    return apiRequest('/api/chat/chats');
}

async function apiGetMessages(chatId, type) {
    return apiRequest(`/api/chat/messages?chatId=${chatId}&type=${type}`);
}

async function apiSendMessage(data) {
    return apiRequest('/api/chat/send', 'POST', data);
}

async function apiMarkRead(chatId, type) {
    return apiRequest('/api/chat/mark-read', 'POST', { chatId, type });
}

async function apiGetGroups() {
    return apiRequest('/api/chat/groups');
}

async function apiCreateGroup(name) {
    return apiRequest('/api/chat/groups', 'POST', { name });
}

async function apiGetChannels() {
    return apiRequest('/api/chat/channels');
}

async function apiGetContacts() {
    return apiRequest('/api/chat/contacts');
}

async function apiSearchUsers(query) {
    return apiRequest(`/api/chat/search?q=${encodeURIComponent(query)}`);
}

// ==================== ADMIN API ====================
async function apiAdminLogin(password) {
    return apiRequest('/api/admin/login', 'POST', { password });
}

async function apiAdminStats() {
    return apiRequest('/api/admin/stats');
}

async function apiAdminUsers() {
    return apiRequest('/api/admin/users');
}

async function apiAdminApproveUser(userId) {
    return apiRequest('/api/admin/approve-user', 'POST', { userId });
}

async function apiAdminTogglePremium(userId, premium) {
    return apiRequest('/api/admin/update-tier', 'POST', { userId, premium });
}

async function apiAdminDeleteUser(userId) {
    return apiRequest('/api/admin/delete-user', 'POST', { userId });
}

async function apiAdminCreateUser(data) {
    return apiRequest('/api/admin/create-user', 'POST', data);
}

async function apiAdminBroadcast(data) {
    return apiRequest('/api/admin/broadcast', 'POST', data);
}

async function apiAdminBugs() {
    return apiRequest('/api/admin/bugs');
}

async function apiAdminAddBug(data) {
    return apiRequest('/api/admin/add-bug', 'POST', data);
}

async function apiAdminDeleteBug(bugId) {
    return apiRequest('/api/admin/delete-bug', 'POST', { bugId });
}

async function apiAdminChannels() {
    return apiRequest('/api/admin/channels');
}

async function apiAdminAddChannel(data) {
    return apiRequest('/api/admin/add-channel', 'POST', data);
}

async function apiAdminDeleteChannel(channelId) {
    return apiRequest('/api/admin/delete-channel', 'POST', { channelId });
}

async function apiAdminGroups() {
    return apiRequest('/api/admin/groups');
}

async function apiAdminCreateGroup(data) {
    return apiRequest('/api/admin/create-group', 'POST', data);
}

async function apiAdminDeleteGroup(groupId) {
    return apiRequest('/api/admin/delete-group', 'POST', { groupId });
}

async function apiAdminPricing() {
    return apiRequest('/api/admin/pricing');
}

async function apiAdminSavePricing(data) {
    return apiRequest('/api/admin/save-pricing', 'POST', data);
}

async function apiAdminLogs() {
    return apiRequest('/api/admin/logs');
}

// ==================== CHANNEL FOLLOW ====================
async function apiFollowChannel(jid) {
    return apiRequest('/api/channel/follow', 'POST', { jid });
}

// ==================== EXPOSE GLOBALLY ====================
window.apiRequest = apiRequest;
window.apiGetUserProfile = apiGetUserProfile;
window.apiUpdateProfile = apiUpdateProfile;
window.apiChangePassword = apiChangePassword;
window.apiUploadAvatar = apiUploadAvatar;
window.apiDeleteAccount = apiDeleteAccount;
window.apiGetStatus = apiGetStatus;
window.apiGetDeviceStatus = apiGetDeviceStatus;
window.apiGetBugs = apiGetBugs;
window.apiExecuteBug = apiExecuteBug;
window.apiGetUnbans = apiGetUnbans;
window.apiExecuteUnban = apiExecuteUnban;
window.apiClaimDaily = apiClaimDaily;
window.apiGetReferralStats = apiGetReferralStats;
window.apiGetCoinHistory = apiGetCoinHistory;
window.apiGetChats = apiGetChats;
window.apiGetMessages = apiGetMessages;
window.apiSendMessage = apiSendMessage;
window.apiMarkRead = apiMarkRead;
window.apiGetGroups = apiGetGroups;
window.apiCreateGroup = apiCreateGroup;
window.apiGetChannels = apiGetChannels;
window.apiGetContacts = apiGetContacts;
window.apiSearchUsers = apiSearchUsers;
window.apiAdminLogin = apiAdminLogin;
window.apiAdminStats = apiAdminStats;
window.apiAdminUsers = apiAdminUsers;
window.apiAdminApproveUser = apiAdminApproveUser;
window.apiAdminTogglePremium = apiAdminTogglePremium;
window.apiAdminDeleteUser = apiAdminDeleteUser;
window.apiAdminCreateUser = apiAdminCreateUser;
window.apiAdminBroadcast = apiAdminBroadcast;
window.apiAdminBugs = apiAdminBugs;
window.apiAdminAddBug = apiAdminAddBug;
window.apiAdminDeleteBug = apiAdminDeleteBug;
window.apiAdminChannels = apiAdminChannels;
window.apiAdminAddChannel = apiAdminAddChannel;
window.apiAdminDeleteChannel = apiAdminDeleteChannel;
window.apiAdminGroups = apiAdminGroups;
window.apiAdminCreateGroup = apiAdminCreateGroup;
window.apiAdminDeleteGroup = apiAdminDeleteGroup;
window.apiAdminPricing = apiAdminPricing;
window.apiAdminSavePricing = apiAdminSavePricing;
window.apiAdminLogs = apiAdminLogs;
window.apiFollowChannel = apiFollowChannel;
