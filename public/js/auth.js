/**
 * ============================================================
 * SCORPION X – AUTH.JS
 * Authentication (login, register, password reset)
 * ============================================================
 */

const SESSION_KEY = 'authToken';

// ==================== REGISTER ====================
async function registerUser(formData) {
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, message: 'Server error' };
    }
}

// ==================== LOGIN ====================
async function loginUser(email, password, remember = false) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, remember })
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'Server error' };
    }
}

// ==================== HANDLE LOGIN RESPONSE ====================
function handleLoginResponse(data) {
    if (data.success && data.token) {
        // Store token
        const remember = document.getElementById('rememberMe')?.checked || false;
        if (remember) {
            localStorage.setItem(SESSION_KEY, data.token);
        } else {
            sessionStorage.setItem(SESSION_KEY, data.token);
        }

        // Store user data
        if (data.user) {
            window.currentUser = data.user;
        }

        showToast('✅ Success', 'Login successful!');
        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 1000);
        return true;
    } else if (data.pendingApproval) {
        showToast('⏳ Pending', 'Account awaiting admin approval');
        return false;
    } else {
        showToast('❌ Error', data.message || 'Login failed');
        return false;
    }
}

// ==================== FORGOT PASSWORD ====================
async function requestPasswordReset(email) {
    try {
        const response = await fetch('/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Password reset error:', error);
        return { success: false, message: 'Server error' };
    }
}

// ==================== RESET PASSWORD ====================
async function resetPassword(token, newPassword) {
    try {
        const response = await fetch('/api/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Reset password error:', error);
        return { success: false, message: 'Server error' };
    }
}

// ==================== PASSWORD STRENGTH CHECKER ====================
function checkPasswordStrength(password) {
    let score = 0;
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[^A-Za-z0-9]/.test(password)
    };

    Object.values(checks).forEach(v => { if (v) score++; });

    const levels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
    const colors = ['#ff4444', '#ff6644', '#ffaa44', '#aaff44', '#44ff88', '#00ff88'];
    const percent = (score / 5) * 100;

    return {
        score,
        level: levels[score],
        color: colors[score],
        percent: percent,
        checks
    };
}

// ==================== EXPOSE GLOBALLY ====================
window.registerUser = registerUser;
window.loginUser = loginUser;
window.handleLoginResponse = handleLoginResponse;
window.requestPasswordReset = requestPasswordReset;
window.resetPassword = resetPassword;
window.checkPasswordStrength = checkPasswordStrength;
