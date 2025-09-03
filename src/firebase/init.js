import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Firebase authentication provider
const provider = new GoogleAuthProvider();
provider.addScope('email');
provider.addScope('profile');

// Global application state
export const state = {
  db: null,
  auth: null,
  userId: null,
  unsubscribeFunctions: null,
  userEmail: null,
  userName: null,
  userRole: null, // null, 'viewer', 'member', 'admin'
  userPlayerId: null, // Link to player profile
  isLoggedIn: false,
  signingIn: false,
  activeTab: 'match',
  players: [],
  seasons: [],
  activeSeasonId: null,
  selectedStatsSeasonId: 'all-time',
  playerCard: { isOpen: false, playerId: null, selectedSeasonId: 'all-time' },
  fixture: { id: null, games: [], activeGameIndex: 0 },
  previousFixtures: [],
  selectedPreviousFixtureId: null,
  currentGameIndex: 0,
  lastTurnSeq: 0,
  confirmation: { action: null, data: null },
  loginAttemptRole: null,
  logoutTimer: null,
  h2h: { player1: null, player2: null },
  myProfile: { selectedPlayerId: null },
  leaderboardSort: { column: 'gamesWon', direction: 'desc' }
};

// Simple rate limiter for Firebase operations
const rateLimiter = {
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

// Wrapper for Firebase calls that applies rate limiting
export const safeFirebaseCall = async (operation, firebaseFunction) => {
  rateLimiter.checkAndBlock(operation, 50, 60000); // 50 requests per minute
  return await firebaseFunction();
};

// Basic input validation
export function validateInput(input, maxLength = 100) {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }
  if (input.length > maxLength) {
    throw new Error(`Input too long (max ${maxLength} characters)`);
  }
  const dangerousPatterns = [/<script/i, /javascript:/i, /data:/i, /vbscript:/i, /onload=/i, /onerror=/i];
  for (const pattern of dangerousPatterns) {
    if (pattern.test(input)) {
      throw new Error('Invalid characters detected');
    }
  }
  return input.trim();
}

// Validate any stored authentication data
export function validateStoredData() {
  const allowedRoles = ['viewer', 'scorer', 'member', 'admin'];
  const storedRole = localStorage.getItem('userRole');
  if (storedRole && !allowedRoles.includes(storedRole)) {
    console.warn('Invalid role in storage, clearing...');
    localStorage.removeItem('userRole');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('loginTimestamp');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userId');
    return false;
  }
  const loginTimestamp = Number(localStorage.getItem('loginTimestamp'));
  if (loginTimestamp && (Date.now() - loginTimestamp > SESSION_DURATION_MS)) {
    console.warn('Session expired, clearing storage...');
    localStorage.removeItem('userRole');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('loginTimestamp');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userId');
    return false;
  }
  return true;
}

// Session duration constant used by validation
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

let app;
export let db;
export let auth;

// Initialize Firebase services and populate the state object
export function initFirebase() {
  const isDevelopment = location.hostname.includes('github.dev') ||
    location.hostname.includes('codespaces') ||
    location.hostname.includes('app.github.dev') ||
    location.hostname.includes('localhost');

  const firebaseConfig = isDevelopment
    ? {
        apiKey: "AIzaSyC6Ctix8MZtCj6AkWCLkwtZPayOidXLITA",
        authDomain: "burnabydartsdev.firebaseapp.com",
        projectId: "burnabydartsdev",
        storageBucket: "burnabydartsdev.firebasestorage.app",
        messagingSenderId: "372591363063",
        appId: "1:372591363063:web:84fee08add7b4d1abce4f2"
      }
    : {
        apiKey: "AIzaSyCU66DqSCzkwaEhTLEOftEJtKbt9y4xVeI",
        authDomain: "darts-app-9e752.firebaseapp.com",
        databaseURL: "https://darts-app-9e752-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "darts-app-9e752",
        storageBucket: "darts-app-9e752.appspot.com",
        messagingSenderId: "520662271304",
        appId: "1:520662271304:web:abb1ca68445511c8bb1f7d"
      };

  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);

  state.db = db;
  state.auth = auth;

  return { app, db, auth, state };
}

export {
  provider,
  signInAnonymously,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  firebaseSignOut,
  onAuthStateChanged,
  updateProfile
};
