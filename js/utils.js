import { state } from './state.js';
import { ui } from './ui-elements.js';

export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; 
export const GAME_TITLES = ["Singles 1", "Singles 2", "Singles 3", "Singles 4", "Singles 5", "Doubles 1", "Doubles 2"];
export const PLAYERS_COLLECTION = 'players';
export const FIXTURES_COLLECTION = 'fixtures';
export const SEASONS_COLLECTION = 'seasons';

export const rateLimiter = {
    requests: new Map(),

    isAllowed(operation = 'general', limit = 100, windowMs = 60000) {
        const userId = state.userId || 'anonymous';
        const key = `${userId}-${operation}`;
        const now = Date.now();

        const userRequests = this.requests.get(key) || [];
        const recentRequests = userRequests.filter(time => now - time < windowMs);

        if (recentRequests.length >= limit) {
            return false;
        }

        this.requests.set(key, [...recentRequests, now]);
        return true;
    },

    checkAndBlock(operation, limit, windowMs) {
        if (!this.isAllowed(operation, limit, windowMs)) {
            throw new Error(`Rate limit exceeded for ${operation}. Please wait before trying again.`);
        }
    }
};

export const safeFirebaseCall = async (operation, firebaseFunction) => {
    rateLimiter.checkAndBlock(operation, 50, 60000); 
    return await firebaseFunction();
};

export function validateInput(input, maxLength = 100) {
    if (typeof input !== 'string') {
        throw new Error('Input must be a string');
    }

    if (input.length > maxLength) {
        throw new Error(`Input too long (max ${maxLength} characters)`);
    }

    const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /data:/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i
    ];

    for (const pattern of dangerousPatterns) {
        if (pattern.test(input)) {
            throw new Error('Invalid characters detected');
        }
    }

    return input.trim();
}

export function triggerHaptic(pattern = 'light') {
    if (!('vibrate' in navigator)) return;

    const patterns = {
        light: 10,     
        medium: 25,     
        heavy: 50,      
        double: [20, 50, 20], 
        success: [20, 100, 30], 
        error: [100, 30, 100, 30, 100], 
        warning: [30, 20, 30] 
    };

    navigator.vibrate(patterns[pattern] || patterns.light);
}

export function showToast(message, type = 'success') {
    if (typeof type === 'boolean') type = type ? 'error' : 'success';
    ui.toast.message.textContent = message;

    const configs = {
        success: {
            color: 'bg-emerald-500',
            icon: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
        },
        error: {
            color: 'bg-red-500',
            icon: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
        },
        warning: {
            color: 'bg-yellow-500',
            icon: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
        }
    };

    const { color, icon } = configs[type] || configs.success;

    if (type === 'success') triggerHaptic('success');
    else if (type === 'error') triggerHaptic('error');
    else if (type === 'warning') triggerHaptic('warning');

    ui.toast.element.classList.remove('bg-emerald-500', 'bg-red-500', 'bg-yellow-500');
    ui.toast.element.classList.add(color);
    ui.toast.icon.innerHTML = icon;

    ui.toast.element.classList.remove('toast-hidden');
    ui.toast.element.classList.add('toast-visible');

    setTimeout(() => {
        ui.toast.element.classList.remove('toast-visible');
        ui.toast.element.classList.add('toast-hidden');
    }, 3000);
}