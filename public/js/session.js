/**
 * ============================================================
 * SCORPION X – SESSION.JS
 * Global session management for all pages
 * ============================================================
 */

const SESSION_KEY = 'authToken';
const ADMIN_SESSION_KEY = 'adminToken';

// ==================== PAGE TYPES ====================
const PAGE_TYPES = {
    PUBLIC: 'public',       // No login required (index, offline, 404)
    PROTECTED: 'protected', // Login required (dashboard, account, etc.)
    GUEST: 'guest'          // Login/register pages (redirect to dashboard if logged in)
};

// ==================== CURRENT PAGE DETECTION ====================
function getCurrentPageType() {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';

    // Public pages (no login required)
    const publicPages = ['index.html', 'offline.html', '404.html', 'forgot-password.html', 'reset-password.html'];
    if (publicPages.includes(page)) return PAGE_TYPES.PUBLIC;

    // Guest pages (redirect to dashboard if logged in)
    const guestPages = ['login.html', 'register.html'];
    if (guestPages.includes(page)) return PAGE_TYPES.GUEST;

    // Everything else is protected
    return PAGE_TYPES.PROTECTED;
}

// ==================== GET TOKEN ====================
function getToken() {
    return localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
}

// ==================== GET ADMIN TOKEN ====================
function getAdminToken() {
    return sessionStorage.getItem(ADMIN_SESSION_KEY);
}

// ==================== MAIN SESSION CHECK ====================
async function checkSession() {
    const pageType = getCurrentPageType();
    const token = getToken();

    // ========== PUBLIC PAGES ==========
    if (pageType === PAGE_TYPES.PUBLIC) {
        // Update nav buttons dynamically
        updateNavButtons(token);
        return;
    }

    // ========== GUEST PAGES (login/register) ==========
    if (pageType === PAGE_TYPES.GUEST) {
        if (token) {
            // Already logged in → redirect to dashboard
            window.location.href = '/dashboard.html';
        }
        return;
    }

    // ========== PROTECTED PAGES ==========
    if (pageType === PAGE_TYPES.PROTECTED) {
        if (!token) {
            // No token → redirect to login
            window.location.href = '/login.html';
            return;
        }

        // Verify token with server
        try {
            const response = await fetch('/api/verify-session', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (!data.success) {
                // Invalid or expired token → clear and redirect
                localStorage.removeItem(SESSION_KEY);
                sessionStorage.removeItem(SESSION_KEY);
                window.location.href = '/login.html';
                return;
            }

            // Token is valid → store user data globally
            window.currentUser = data.user;
            updateUserUI(data.user);

        } catch (error) {
            console.error('Session verification failed:', error);
            localStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(SESSION_KEY);
            window.location.href = '/login.html';
        }
    }
}

// ==================== UPDATE NAV BUTTONS (Public Pages) ====================
function updateNavButtons(token) {
    const navButtons = document.getElementById('navButtons');
    if (!navButtons) return;

    if (token) {
        navButtons.innerHTML = `
            <a href="/dashboard.html" class="nav-btn">
                <i class="fas fa-tachometer-alt"></i> Dashboard
            </a>
            <a href="#" onclick="logout()" class="nav-btn">
                <i class="fas fa-sign-out-alt"></i> Logout
            </a>
        `;
    } else {
        navButtons.innerHTML = `
            <a href="/login.html" class="nav-btn">
                <i class="fas fa-sign-in-alt"></i> Login
            </a>
            <a href="/register.html" class="nav-btn btn-fire">
                <i class="fas fa-user-plus"></i> Register
            </a>
        `;
    }
}

// ==================== UPDATE USER UI ====================
function updateUserUI(user) {
    // Update username display
    const usernameEl = document.getElementById('usernameDisplay');
    if (usernameEl) {
        usernameEl.textContent = user.username || user.email.split('@')[0];
    }

    // Update avatar
    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl && user.avatar) {
        avatarEl.src = user.avatar;
    }

    // Update coin display
    const coinEl = document.getElementById('coinDisplay');
    if (coinEl) {
        coinEl.textContent = user.coins || 0;
    }

    // Update premium badge
    const premiumBadge = document.getElementById('premiumBadge');
    if (premiumBadge) {
        if (user.isPremium) {
            premiumBadge.style.display = 'inline-block';
            premiumBadge.textContent = '⭐ PREMIUM';
        } else {
            premiumBadge.style.display = 'none';
        }
    }

    // Update tier display
    const tierEl = document.getElementById('tierDisplay');
    if (tierEl) {
        tierEl.textContent = user.isPremium ? 'Premium 🔥' : 'Lite 💀';
        tierEl.className = user.isPremium ? 'badge badge-premium' : 'badge badge-lite';
    }
}

// ==================== LOGOUT FUNCTION ====================
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
    } catch (e) { /* ignore */ }
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = '/login.html';
}

// ==================== RUN ON PAGE LOAD ====================
document.addEventListener('DOMContentLoaded', checkSession);

// ==================== EXPOSE GLOBALLY ====================
window.checkSession = checkSession;
window.logout = logout;
window.getToken = getToken;
window.getAdminToken = getAdminToken;
window.currentUser = null;
