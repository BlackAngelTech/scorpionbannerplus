/**
 * ============================================================
 * SCORPION X – APP.JS
 * Main app functionality (sidebar, particles, cursor)
 * ============================================================
 */

// ==================== SIDEBAR TOGGLE ====================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

// ==================== CLOSE SIDEBAR ON OUTSIDE CLICK ====================
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.querySelector('.hamburger');
    if (sidebar && sidebar.classList.contains('open') && 
        !sidebar.contains(e.target) && 
        hamburger && !hamburger.contains(e.target)) {
        sidebar.classList.remove('open');
    }
});

// ==================== CURSOR GLOW ====================
function initCursorGlow() {
    const cursorGlow = document.getElementById('cursorGlow');
    if (!cursorGlow) return;

    // Hide on touch devices
    if ('ontouchstart' in window) {
        cursorGlow.style.display = 'none';
        return;
    }

    document.addEventListener('mousemove', (e) => {
        cursorGlow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    });
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(title, msg, duration = 4000) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    const titleEl = document.getElementById('toastTitle');
    const msgEl = document.getElementById('toastMsg');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = msg;

    toast.classList.add('active');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('active');
    }, duration);
}

// ==================== FORMAT NUMBER ====================
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num;
}

// ==================== ESCAPE HTML ====================
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ==================== COPY TO CLIPBOARD ====================
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('📋 Copied!', 'Copied to clipboard');
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showToast('📋 Copied!', 'Copied to clipboard');
    } catch (e) {
        showToast('❌ Error', 'Could not copy');
    }
    document.body.removeChild(textarea);
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    initCursorGlow();
});

// ==================== EXPOSE GLOBALLY ====================
window.toggleSidebar = toggleSidebar;
window.showToast = showToast;
window.formatNumber = formatNumber;
window.escapeHtml = escapeHtml;
window.copyToClipboard = copyToClipboard;
