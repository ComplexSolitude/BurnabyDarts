import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from '../state.js';
import { ui } from '../ui-elements.js';
import { showToast, safeFirebaseCall, FIXTURES_COLLECTION, triggerHaptic } from '../utils.js';
import { renderOverallScore } from './fixtures.js';
import { renderCurrentGameFines } from './fines.js';
import { render } from '../app.js';

export function triggerPlayerChangeAnimation() {
    const el = ui.currentPlayerNames;
    el.classList.remove('animate-pulse');
    void el.offsetWidth;
    el.classList.add('animate-pulse');
}

export async function updateGameData() {
    if (!state.fixture.id) return;
    const fixtureRef = doc(state.db, FIXTURES_COLLECTION, state.fixture.id);
    try {
        await safeFirebaseCall('updateGame', async () => {
            return await updateDoc(fixtureRef, {
                games: state.fixture.games,
                activeGameIndex: state.fixture.activeGameIndex || 0
            });
        });
    } catch (error) {
        if (error.message.includes('Rate limit')) {
            showToast(error.message, 'error');
        } else {
            console.error("Error updating game data:", error);
            showToast("Could not save latest score, check connection.", 'error');
        }
    }
}

export function updateStat(stat, value, playerIndex = 0) {
    const game = state.fixture.games[state.currentGameIndex];
    if (!game) return;

    if (stat === 'legsWon' || stat === 'legsLost') {
        if (value > 0) {
            if ((game.legsWon || 0) + (game.legsLost || 0) >= 3) {
                showToast("Cannot play more than 3 legs in a game.", 'error');
                return;
            }
        }
    }

    if (!game.playerScores) game.playerScores = [{}, {}];

    if(stat.startsWith('scores') || stat === 'sillyThings') {
        const playerScores = game.playerScores[playerIndex] || {};
        playerScores[stat] = Math.max(0, (playerScores[stat] || 0) + value);
        game.playerScores[playerIndex] = playerScores;
    } else {
         game[stat] = Math.max(0, (game[stat] || 0) + value);
    }
    render();
    updateGameData();
}

export function renderLiveMatch() {
    const isViewer = state.userRole === 'viewer';
    const wrongTeam = state.fixture.team !== state.userTeam;
    const cannotScore = isViewer || wrongTeam;
    document.querySelectorAll('#live-match-content button, #live-match-content input').forEach(el => {
       if(el.id !== 'prev-game-btn' && el.id !== 'next-game-btn') {
           el.disabled = cannotScore;
       }
    });

    if (!state.fixture.id || !state.fixture.games || state.fixture.games.length === 0) {
        ui.liveMatchContent.classList.add('hidden');
        ui.noFixtureMessage.classList.remove('hidden');
        return;
    }
    ui.liveMatchContent.classList.remove('hidden');
    ui.noFixtureMessage.classList.add('hidden');

    renderOverallScore(ui.liveScoringScoreContainer);

    const game = state.fixture.games[state.currentGameIndex];
    if (!game) {
        console.error("Could not find game data for the current index.");
        return;
    }

    const isDoubles = game.playerIds.length > 1;
    ui.singlesScoringPanel.classList.toggle('hidden', isDoubles);
    ui.doublesScoringPanel.classList.toggle('hidden', !isDoubles);
    ui.finesPanel.classList.remove('hidden');

    const playerNames = game.playerIds.map(id => {
        const player = state.players.find(p => p.id === id);
        return player?.nickname || player?.name || 'Unknown';
    });
    const namesText = playerNames.join(' & ');
    ui.currentPlayerNames.textContent = namesText;
    const turnSeq = game.turnSeq || 0;
    if (state.lastTurnSeq !== turnSeq) {
        triggerPlayerChangeAnimation();
        state.lastTurnSeq = turnSeq;
    }
    ui.gameNavTitle.textContent = game.title;

    if(isDoubles) {
        ui.doublesPlayerNames.p1.textContent = playerNames[0];
        ui.doublesPlayerNames.p2.textContent = playerNames[1];
    }

    ui.statValueSpans.legsWon.textContent = game.legsWon || 0;
    ui.statValueSpans.legsLost.textContent = game.legsLost || 0;
    ui.statValueSpans.fines.textContent = `£${((game.fines || 0) / 100).toFixed(2)}`;
    
    renderCurrentGameFines(game);
    
    ui.highCheckoutInput.value = game.highCheckout || '';
    
    const p1Scores = game.playerScores?.[0] || {};
    const p2Scores = game.playerScores?.[1] || {};

    if(isDoubles) {
        const p1Input = document.getElementById('p1-high-checkout-input');
        const p2Input = document.getElementById('p2-high-checkout-input');
        if (p1Input) p1Input.value = p1Scores.highCheckout || '';
        if (p2Input) p2Input.value = p2Scores.highCheckout || '';
    }

    if (isDoubles) {
        ui.statValueSpans.p1_scores100.textContent = p1Scores.scores100 || 0;
        ui.statValueSpans.p1_scores140.textContent = p1Scores.scores140 || 0;
        ui.statValueSpans.p1_scores180.textContent = p1Scores.scores180 || 0;
        ui.statValueSpans.p1_sillyThings.textContent = p1Scores.sillyThings || 0;
        ui.statValueSpans.p2_scores100.textContent = p2Scores.scores100 || 0;
        ui.statValueSpans.p2_scores140.textContent = p2Scores.scores140 || 0;
        ui.statValueSpans.p2_scores180.textContent = p2Scores.scores180 || 0;
        ui.statValueSpans.p2_sillyThings.textContent = p2Scores.sillyThings || 0;
    } else {
        ui.statValueSpans.scores100.textContent = p1Scores.scores100 || 0;
        ui.statValueSpans.scores140.textContent = p1Scores.scores140 || 0;
        ui.statValueSpans.scores180.textContent = p1Scores.scores180 || 0;
        ui.statValueSpans.sillyThings.textContent = p1Scores.sillyThings || 0;
    }

    ui.prevGameBtn.disabled = state.currentGameIndex === 0;
    ui.nextGameBtn.disabled = state.currentGameIndex === state.fixture.games.length - 1;

    const isFinalGame = state.fixture.games && state.fixture.games.length > 0 && state.currentGameIndex === state.fixture.games.length - 1;
    const finishMatchBtn = document.getElementById('finish-match-btn');

    if (isFinalGame && (state.userRole === 'scorer' || state.userRole === 'member' || state.userRole === 'admin')) {
        finishMatchBtn.classList.remove('hidden');
    } else {
        finishMatchBtn.classList.add('hidden');
    }
}

export function openDotdModal() {
    showToast('Match Complete!');

    const allPlayerIdsInFixture = [...new Set(state.fixture.games.flatMap(game => game.playerIds))];

    ui.dotdModal.list.innerHTML = '';
    allPlayerIdsInFixture.forEach(playerId => {
        const player = state.players.find(p => p.id === playerId);
        if (!player) return;

        let sillyThingsCount = 0;
        state.fixture.games.forEach(game => {
            if (game.playerIds.includes(playerId)) {
                const playerIndex = game.playerIds.indexOf(playerId);
                sillyThingsCount += game.playerScores?.[playerIndex]?.sillyThings || 0;
            }
        });

        const playerEl = document.createElement('div');
        playerEl.className = 'flex items-center justify-between';
        playerEl.innerHTML = `
            <div>
                <input id="dotd-${player.id}" name="dotd-vote" type="radio" value="${player.id}" class="h-4 w-4 text-emerald-600 border-gray-300 focus:ring-emerald-500">
                <label for="dotd-${player.id}" class="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">${player.name}</label>
            </div>
            <span class="text-sm font-medium text-gray-500 dark:text-gray-400">? x ${sillyThingsCount}</span>
        `;
        ui.dotdModal.list.appendChild(playerEl);
    });

    ui.dotdModal.overlay.classList.remove('hidden');
    ui.dotdModal.overlay.classList.add('flex');
    document.body.classList.add('modal-open');
}