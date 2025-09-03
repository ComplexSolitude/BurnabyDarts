import { auth, provider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, state, safeFirebaseCall } from '../firebase/init.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

async function handlePostSignIn(user) {
  if (!user) return;
  state.userId = user.uid;
  state.userEmail = user.email || null;
  state.userName = user.displayName || null;

  let role = 'viewer';
  if (state.db) {
    const userRef = doc(state.db, 'users', user.uid);
    try {
      const snap = await safeFirebaseCall('getUserRole', () => getDoc(userRef));
      if (snap.exists()) {
        const data = snap.data();
        role = data.role || role;
      } else {
        await safeFirebaseCall('createUserDoc', () => setDoc(userRef, { email: user.email, role }));
      }
    } catch (err) {
      console.error('Failed to load user role', err);
    }
  }
  state.userRole = role;

  try {
    localStorage.setItem('userRole', role);
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('loginTimestamp', Date.now().toString());
    if (user.email) localStorage.setItem('userEmail', user.email);
    localStorage.setItem('userId', user.uid);
  } catch (err) {
    console.warn('Failed to persist login info', err);
  }

  const roleSelection = document.getElementById('role-selection-overlay');
  const mainApp = document.getElementById('main-app');
  if (roleSelection) roleSelection.classList.add('hidden');
  if (mainApp) mainApp.classList.remove('hidden');
}

export function initAuth() {
  const googleBtn = document.getElementById('google-signin-btn');
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      try {
        const result = await safeFirebaseCall('googleSignIn', () => signInWithPopup(auth, provider));
        await handlePostSignIn(result.user);
      } catch (err) {
        console.error('Google sign-in failed', err);
      }
    });
  }

  const emailBtn = document.getElementById('email-signin-btn');
  if (emailBtn) {
    emailBtn.addEventListener('click', async () => {
      const email = document.getElementById('email-input')?.value || '';
      const password = document.getElementById('password-input')?.value || '';
      try {
        const result = await safeFirebaseCall('emailSignIn', () => signInWithEmailAndPassword(auth, email, password));
        await handlePostSignIn(result.user);
      } catch (err) {
        console.error('Email sign-in failed', err);
      }
    });
  }

  const createBtn = document.getElementById('create-account-btn');
  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      const email = document.getElementById('email-input')?.value || '';
      const password = document.getElementById('password-input')?.value || '';
      try {
        const result = await safeFirebaseCall('createAccount', () => createUserWithEmailAndPassword(auth, email, password));
        const user = result.user;
        if (!user.displayName && email) {
          const displayName = email.split('@')[0];
          await safeFirebaseCall('updateProfile', () => updateProfile(user, { displayName }));
          user.displayName = displayName;
        }
        await handlePostSignIn(user);
      } catch (err) {
        console.error('Account creation failed', err);
      }
    });
  }
}

