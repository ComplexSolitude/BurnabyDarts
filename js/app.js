import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { auth } from './firebase-config.js';
import { state } from './state.js';
import { ui } from './ui-elements.js';
import { validateStoredData, triggerHaptic } from './utils.js';
import { handleGoogleSignIn, handleEmailSignIn, handleEmailSignUp, handleHeaderButtonClick, openSignupModal, closeSignupModal } from './auth.js';
import { loadUsers } from './modules/admin.js';
import { renderLeaderboard, renderMyProfile, renderH2HTab } from './modules/stats.js';
import { renderFines } from './modules/fines.js';
import { closeFixtureModal } from './modules/fixtures.js';

// --- CORE APP LOGIC ---
export function switchTab(tabId) {
    state.activeTab = tabId;
    triggerHaptic('light');

    Object.keys(ui.tabs).forEach(key => {
        if (!ui.tabs[key]) return;
        if (key === tabId) {
            ui.tabs[key].classList.add('bg-emerald-700', 'text-white', 'shadow-sm');
            ui.tabs[key].classList.remove('text-emerald-100', 'hover:bg-emerald-700', 'hover:text-white');
        } else {
            ui.tabs[key].classList.remove('bg-emerald-700', 'text-white', 'shadow-sm');
            ui.tabs[key].classList.add('text-emerald-100', 'hover:bg-emerald-700', 'hover:text-white');
        }
    });

    Object.keys(ui.content).forEach(key => {
        if (!ui.content[key]) return;
        if (key === tabId) {
            ui.content[key].classList.remove('hidden');
            ui.content[key].classList.add('tab-enter');
        } else {
            ui.content[key].classList.add('hidden');
            ui.content[key].classList.remove('tab-enter', 'tab-leave');
        }
    });

    if (window.innerWidth < 768) {
        ui.mobileMenuOverlay.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }

    render();
}

export function openConfirmModal(title, text, action, data = null) {
    state.confirmation = { action, data };
    ui.confirmModal.title.textContent = title;
    ui.confirmModal.text.textContent = text;
    ui.confirmModal.overlay.classList.remove('hidden');
    ui.confirmModal.overlay.classList.add('flex');
    document.body.classList.add('modal-open');
}

export function closeConfirmModal() {
    state.confirmation = { action: null, data: null };
    ui.confirmModal.overlay.classList.add('hidden');
    ui.confirmModal.overlay.classList.remove('flex');
    document.body.classList.remove('modal-open');
}

export function render() {
    if (!state.isLoggedIn) return;

    if (state.activeTab === 'stats') {
        renderLeaderboard();
    } else if (state.activeTab === 'my-profile') {
        renderMyProfile();
    } else if (state.activeTab === 'h2h') {
        renderH2HTab();
    } else if (state.activeTab === 'fines') {
        renderFines();
    } else if (state.activeTab === 'admin') {
        if (state.userRole === 'admin') loadUsers();
    }
}

function initApp() {
    // Auth listeners
    document.getElementById('google-signin-btn')?.addEventListener('click', handleGoogleSignIn);
    document.getElementById('email-signin-btn')?.addEventListener('click', handleEmailSignIn);
    document.getElementById('open-signup-btn')?.addEventListener('click', openSignupModal);
    document.getElementById('close-signup-btn')?.addEventListener('click', closeSignupModal);
    document.getElementById('signup-modal-submit')?.addEventListener('click', handleEmailSignUp);
    ui.headerSignoutBtn?.addEventListener('click', handleHeaderButtonClick);
    
    // Tab listeners
    Object.keys(ui.tabs).forEach(key => {
        ui.tabs[key]?.addEventListener('click', () => switchTab(key));
    });

    // Mobile menu
    ui.hamburgerBtn?.addEventListener('click', () => {
        ui.mobileMenuOverlay.classList.remove('hidden');
        document.body.classList.add('modal-open');
    });
    ui.closeMenuBtn?.addEventListener('click', () => {
        ui.mobileMenuOverlay.classList.add('hidden');
        document.body.classList.remove('modal-open');
    });

    // Theme toggle
    const toggleTheme = () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        ui.themeIconsMobile.sun?.classList.toggle('hidden', isDark);
        ui.themeIconsMobile.moon?.classList.toggle('hidden', !isDark);
    };
    ui.themeToggleBtnMobile?.addEventListener('click', toggleTheme);

    // Initial check
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        ui.themeIconsMobile.sun?.classList.add('hidden');
        ui.themeIconsMobile.moon?.classList.remove('hidden');
    }

    // Modal listeners
    ui.playerCardModal.closeBtn?.addEventListener('click', closeFixtureModal);
    ui.confirmModal.cancel?.addEventListener('click', closeConfirmModal);

    // Initial Auth State
    onAuthStateChanged(auth, (user) => {
        if (user && validateStoredData()) {
            state.isLoggedIn = true;
            state.userId = user.uid;
            ui.roleSelectionOverlay.classList.add('hidden');
            ui.mainApp.classList.remove('hidden');
        } else {
            state.isLoggedIn = false;
            ui.mainApp.classList.add('hidden');
            ui.roleSelectionOverlay.classList.remove('hidden');
        }
    });
}

document.addEventListener('DOMContentLoaded', initApp);