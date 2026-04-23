import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { auth, db, provider } from './firebase-config.js';
import { state, SESSION_DURATION_MS } from './state.js';
import { ui } from './ui-elements.js';
import { showToast, resetSignInButtonState } from './utils.js';
import { render } from './app.js'; // We will create this file shortly!

export async function handleGoogleSignIn() {
    if (state.signingIn) return;
    state.signingIn = true;

    const loadingOverlay = document.getElementById('loading-overlay');
    const signInBtn = document.getElementById('google-signin-btn');
    const signInText = document.getElementById('signin-btn-text');

    loadingOverlay.classList.remove('opacity-0', 'pointer-events-none');
    loadingOverlay.classList.add('opacity-100');
    signInBtn.disabled = true;
    signInText.textContent = 'Signing in...';
    signInBtn.classList.add('opacity-75', 'cursor-not-allowed');

    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const email = user.email;

        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (userDoc.exists()) {
            const userData = userDoc.data();
            state.userRole = userData.role || 'viewer';
            state.userPlayerId = userData.playerId || null;
        } else {
            state.userRole = 'viewer';
            state.userPlayerId = null;
            const userName = user.displayName || email.split('@')[0] || 'New User';
            await setDoc(doc(db, 'users', user.uid), {
                email: email,
                name: userName,
                role: 'viewer',
                playerId: null,
                team: null,
                createdAt: serverTimestamp()
            });
        }

        await handleSuccessfulSignIn(user);

    } catch (error) {
        console.error('Google Sign-In error:', error);
        loadingOverlay.classList.remove('opacity-100');
        loadingOverlay.classList.add('opacity-0', 'pointer-events-none');
        signInBtn.disabled = false;
        signInText.textContent = 'Sign in with Google';
        signInBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        
        if (error.code === 'auth/popup-closed-by-user') {
            showToast('Sign-in cancelled.', 'warning');
        } else if (error.code === 'auth/cancelled-popup-request') {
            showToast('Sign-in already in progress.', 'warning');
        } else {
            showToast('Sign-in failed. Please try again.', 'error');
        }
    } finally {
        state.signingIn = false;
    }
}

export async function handleHeaderButtonClick() {
    if (state.isLoggedIn) {
        try {
            await firebaseSignOut(auth);
        } catch (error) {
            console.error('Sign-out error:', error);
        }

        if (state.logoutTimer) {
            clearTimeout(state.logoutTimer);
            state.logoutTimer = null;
        }

        state.isLoggedIn = false;
        state.userRole = null;
        state.userEmail = null;
        state.userName = null;
        state.userPlayerId = null;
        state.signingIn = false; 

        localStorage.removeItem('userRole');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('loginTimestamp');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userId');
        resetSignInButtonState();
        showToast('You have been logged out.');
        ui.mainApp.classList.add('hidden');
        ui.roleSelectionOverlay.classList.remove('hidden');
        render();
    } else if (state.userRole === 'viewer') {
        state.userRole = null;
        state.signingIn = false; 
        localStorage.removeItem('userRole');
        resetSignInButtonState();
        ui.mainApp.classList.add('hidden');
        ui.roleSelectionOverlay.classList.remove('hidden');
        render();
    }
}

export async function handleLogout() {
    return handleHeaderButtonClick();
}

export async function handleEmailSignIn() {
    if (state.signingIn) return;
    state.signingIn = true;

    const loadingOverlay = document.getElementById('loading-overlay');
    const signInBtn = document.getElementById('email-signin-btn');

    loadingOverlay.classList.remove('opacity-0', 'pointer-events-none');
    loadingOverlay.classList.add('opacity-100');
    signInBtn.disabled = true;
    signInBtn.textContent = 'Signing in...';

    const email = document.getElementById('email-input').value.trim();
    const password = document.getElementById('password-input').value;

    if (!email || !password) {
        showToast('Please enter both email and password.', 'warning');
        resetEmailSignInState();
        return;
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await handleSuccessfulSignIn(userCredential.user);
    } catch (error) {
        console.error('Email Sign-In error:', error);
        if (error.code === 'auth/user-not-found') {
            showToast('No account found with this email.', 'error');
        } else if (error.code === 'auth/wrong-password') {
            showToast('Incorrect password.', 'error');
        } else if (error.code === 'auth/invalid-email') {
            showToast('Invalid email address.', 'error');
        } else if (error.code === 'auth/too-many-requests') {
            showToast('Too many failed attempts. Please try again later.', 'error');
        } else {
            showToast('Sign-in failed. Please try again.', 'error');
        }
        resetEmailSignInState();
    }
}

export function openSignupModal() {
    document.getElementById('signup-modal').classList.remove('hidden');
    document.getElementById('signup-modal').classList.add('flex');
    document.getElementById('signup-name').focus();
    document.body.classList.add('modal-open');
}

export function closeSignupModal() {
    document.getElementById('signup-modal').classList.add('hidden');
    document.getElementById('signup-modal').classList.remove('flex');
    document.getElementById('signup-name').value = '';
    document.getElementById('signup-email').value = '';
    document.getElementById('signup-password').value = '';
    document.getElementById('signup-confirm-password').value = '';
    document.body.classList.remove('modal-open');
}

export async function handleEmailSignUp() {
    if (state.signingIn) return;
    state.signingIn = true;

    const loadingOverlay = document.getElementById('loading-overlay');
    const signUpBtn = document.getElementById('signup-modal-submit');

    signUpBtn.disabled = true;
    signUpBtn.textContent = 'Creating account...';

    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    if (!name || !email || !password || !confirmPassword) {
        showToast('Please fill in all fields.', 'warning');
        resetEmailSignUpState();
        return;
    }

    if (password !== confirmPassword) {
        showToast('Passwords do not match.', 'warning');
        resetEmailSignUpState();
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters.', 'warning');
        resetEmailSignUpState();
        return;
    }

    loadingOverlay.classList.remove('opacity-0', 'pointer-events-none');
    loadingOverlay.classList.add('opacity-100');

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { name: name });
        await handleSuccessfulSignIn(userCredential.user);
        closeSignupModal();
        showToast('Account created successfully!');
    } catch (error) {
        console.error('Email Sign-Up error:', error);
        if (error.code === 'auth/email-already-in-use') {
            showToast('An account with this email already exists.', 'error');
        } else if (error.code === 'auth/weak-password') {
            showToast('Password is too weak.', 'error');
        } else if (error.code === 'auth/invalid-email') {
            showToast('Invalid email address.', 'error');
        } else {
            showToast('Account creation failed. Please try again.', 'error');
        }
        loadingOverlay.classList.remove('opacity-100');
        loadingOverlay.classList.add('opacity-0', 'pointer-events-none');
        resetEmailSignUpState();
    }
}

export async function handleSuccessfulSignIn(user) {
    const email = user.email;
    const userDoc = await getDoc(doc(db, 'users', user.uid));

    if (userDoc.exists()) {
        const userData = userDoc.data();
        state.userRole = userData.role || 'viewer';
        state.userPlayerId = userData.playerId || null;
        state.userTeam = userData.team || null;
        state.activeMatchView = userData.team || null;
        state.userName = userData.name; 
    } else {
        state.userRole = 'viewer';
        state.userPlayerId = null;
        state.userName = user.displayName || 'New User';
        await setDoc(doc(db, 'users', user.uid), {
            email: email,
            name: state.userName,
            role: 'viewer',
            playerId: null,
            createdAt: serverTimestamp()
        });
    }

    state.isLoggedIn = true;
    state.userEmail = email;
    state.userId = user.uid;

    localStorage.setItem('userRole', state.userRole);
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('loginTimestamp', Date.now().toString());
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userId', user.uid);

    startLogoutTimer();

    setTimeout(() => {
        const loadingOverlay = document.getElementById('loading-overlay');
        loadingOverlay.classList.remove('opacity-100');
        loadingOverlay.classList.add('opacity-0', 'pointer-events-none');
        ui.roleSelectionOverlay.classList.add('hidden');
        ui.mainApp.classList.remove('hidden');
        showToast(`Welcome ${state.userName}!`);
        render();
    }, 500);
}

export function resetEmailSignInState() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const signInBtn = document.getElementById('email-signin-btn');

    loadingOverlay.classList.remove('opacity-100');
    loadingOverlay.classList.add('opacity-0', 'pointer-events-none');
    signInBtn.disabled = false;
    signInBtn.textContent = 'Sign In with Email';
    state.signingIn = false;
}

export function resetEmailSignUpState() {
    const signUpBtn = document.getElementById('signup-modal-submit');
    signUpBtn.disabled = false;
    signUpBtn.textContent = 'Create Account';
    state.signingIn = false;
}

export function startLogoutTimer(duration = SESSION_DURATION_MS) {
    if (state.logoutTimer) {
        clearTimeout(state.logoutTimer);
    }
    state.logoutTimer = setTimeout(handleLogout, duration);
}