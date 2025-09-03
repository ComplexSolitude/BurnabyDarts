import { state, safeFirebaseCall } from '../firebase/init.js';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

/**
 * Start a new match and persist it in Firestore.
 * @param {Array} players Array of player ids participating in the match.
 * @returns {Promise<string>} The id of the newly created match document.
 */
export async function startMatch(players = []) {
  if (!state.db) return null;
  const matchData = {
    players,
    scores: players.map(() => 0),
    createdAt: Date.now()
  };
  const docRef = await safeFirebaseCall('startMatch', () => addDoc(collection(state.db, 'matches'), matchData));
  state.fixture.id = docRef.id;
  return docRef.id;
}

/**
 * Update the scores for the current match in Firestore and the UI.
 * @param {string} matchId Firestore match document id.
 * @param {Array<number>} scores Array of scores per player.
 */
export async function updateScores(matchId, scores) {
  if (!state.db || !matchId) return;
  const matchRef = doc(state.db, 'matches', matchId);
  await safeFirebaseCall('updateScores', () => updateDoc(matchRef, { scores }));

  const container = document.getElementById('live-scoring-score-container');
  if (container) {
    container.textContent = scores.join(' - ');
  }
}

/**
 * Render leaderboard rows into the leaderboard table body.
 * @param {import('firebase/firestore').QuerySnapshot} snapshot Firestore snapshot.
 */
export function renderLeaderboards(snapshot) {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-4 py-2">${data.name || 'Unknown'}</td>
      <td class="px-2 py-2 text-center">${data.gamesWon ?? 0}</td>
      <td class="px-2 py-2 text-center">${data.gamesLost ?? 0}</td>
    `;
    tbody.appendChild(tr);
  });
}

function handleStatButton(event) {
  const { stat, op, playerIndex } = event.currentTarget.dataset;
  const spanId = playerIndex !== undefined
    ? `stat-p${Number(playerIndex) + 1}-${stat}`
    : `stat-${stat}`;
  const span = document.getElementById(spanId);
  if (span) {
    const current = parseInt(span.textContent, 10) || 0;
    const next = Math.max(0, current + parseInt(op, 10));
    span.textContent = next;
  }
}

/**
 * Initialise scoreboard event listeners and Firestore subscriptions.
 */
export function initScoreboard() {
  // Attach listeners for stat buttons
  document.querySelectorAll('.stat-btn').forEach((btn) => {
    btn.addEventListener('click', handleStatButton);
  });

  // Subscribe to leaderboard updates
  if (state.db) {
    const leaderboardRef = collection(state.db, 'leaderboard');
    const q = query(leaderboardRef, orderBy('gamesWon', 'desc'));
    const unsubscribe = onSnapshot(q, renderLeaderboards);
    state.unsubscribeFunctions = state.unsubscribeFunctions || [];
    state.unsubscribeFunctions.push(unsubscribe);
  }

  // Example finish match button
  const finishBtn = document.getElementById('finish-match-btn');
  if (finishBtn) {
    finishBtn.addEventListener('click', () => {
      if (state.fixture.id) {
        console.log(`Match ${state.fixture.id} finished`);
      }
    });
  }
}
