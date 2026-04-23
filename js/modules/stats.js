import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { state, PLAYERS_COLLECTION } from '../state.js';
import { ui } from '../ui-elements.js';
import { showToast } from '../utils.js';
import { getPlayerStats } from './scoring.js';

export function renderLeaderboard() {
    ui.seasonFilterSelect.innerHTML = `<option value="all-time">All-Time</option>`;
    state.seasons.forEach(s => {
        ui.seasonFilterSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });
    ui.seasonFilterSelect.value = state.selectedStatsSeasonId;

    document.querySelectorAll('.column-checkbox').forEach(checkbox => {
       checkbox.checked = state.columnVisibility[checkbox.dataset.column];
    });
   
    ui.leaderboardBody.innerHTML = '';
   
    const visibleColumns = Object.keys(state.columnVisibility).filter(col => state.columnVisibility[col]);
    let filteredPlayers = state.players.filter(p => !p.archived);
    if (state.selectedStatsTeamFilter !== 'all') {
       filteredPlayers = filteredPlayers.filter(p => p.team === state.selectedStatsTeamFilter);
    }
   
    let playersWithStats = filteredPlayers.map(p => {
        const singlesStats = getPlayerStats(p, state.selectedStatsSeasonId, 'singles');
        const combinedStats = getPlayerStats(p, state.selectedStatsSeasonId, 'combined');
        const totalLegs = singlesStats.legsWon + singlesStats.legsLost;
        const legWinPercent = totalLegs > 0 ? ((singlesStats.legsWon / totalLegs) * 100) : 0;
        const gamesPlayed = singlesStats.gamesWon + singlesStats.gamesLost;

        const displayStats = {
            gamesPlayed: gamesPlayed,
            gamesWon: singlesStats.gamesWon,
            gamesLost: singlesStats.gamesLost,
            legsWon: singlesStats.legsWon,
            legsLost: singlesStats.legsLost,
            legWinPercent: legWinPercent,
            scores100: combinedStats.scores100,
            scores140: combinedStats.scores140,
            scores180: combinedStats.scores180,
            highCheckout: combinedStats.highCheckout,
            totalFines: singlesStats.totalFines,
        };

        return { ...p, displayStats: displayStats };
    });

    const { column, direction } = state.leaderboardSort;
    playersWithStats.sort((a, b) => {
        let valA = a.displayStats[column];
        let valB = b.displayStats[column];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        if (column !== 'gamesWon') return b.displayStats.gamesWon - a.displayStats.gamesWon;
        return 0;
    });

    document.querySelectorAll('#stats-table-header th[data-sort]').forEach(header => {
        const headerColumn = header.dataset.sort;
        header.style.display = state.columnVisibility[headerColumn] ? '' : 'none';
    });
    
    playersWithStats.forEach(player => {
        const stats = player.displayStats;
        const tr = document.createElement('tr');
        tr.className = 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700';
        tr.dataset.playerId = player.id;
        
        let cellsHTML = `<td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${player.name}</td>`;
        
        const columnData = {
            gamesPlayed: stats.gamesPlayed,
            gamesWon: stats.gamesWon,
            gamesLost: stats.gamesLost,
            legsWon: stats.legsWon,
            legsLost: stats.legsLost,
            legWinPercent: `${stats.legWinPercent.toFixed(0)}%`,
            scores100: stats.scores100,
            scores140: stats.scores140,
            scores180: stats.scores180,
            highCheckout: stats.highCheckout,
            totalFines: `£${(stats.totalFines / 100).toFixed(2)}`
        };
        
        Object.keys(columnData).forEach(col => {
            if (state.columnVisibility[col]) {
                cellsHTML += `<td class="px-2 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">${columnData[col]}</td>`;
            }
        });
        
        tr.innerHTML = cellsHTML;
        ui.leaderboardBody.appendChild(tr);
    });

    document.querySelectorAll('#stats-table-header th').forEach(th => {
        const existingArrow = th.querySelector('.sort-arrow');
        if (existingArrow) existingArrow.remove();

        if (th.dataset.sort === column) {
            const arrow = document.createElement('span');
            arrow.className = 'sort-arrow ml-1';
            arrow.innerHTML = direction === 'desc' ? '▼' : '▲';
            th.appendChild(arrow);
        }
    });
}

export function generatePlayerCardHTML(playerId, seasonId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return '<p>Player not found.</p>';

    const singlesStats = getPlayerStats(player, seasonId, 'singles');
    const doublesStats = getPlayerStats(player, seasonId, 'doubles');
    const combinedScores = getPlayerStats(player, seasonId, 'combined');

    const totalLegs = singlesStats.legsWon + singlesStats.legsLost;
    const legWinPercent = totalLegs > 0 ? ((singlesStats.legsWon / totalLegs) * 100).toFixed(0) + '%' : 'N/A';
    const totalGames = singlesStats.gamesWon + singlesStats.gamesLost;
    const gameWinPercent = totalGames > 0 ? ((singlesStats.gamesWon / totalGames) * 100).toFixed(0) + '%' : 'N/A';

    let optionsHtml = `<option value="all-time">All-Time</option>`;
    state.seasons.forEach(s => {
        optionsHtml += `<option value="${s.id}" ${s.id === seasonId ? 'selected' : ''}>${s.name}</option>`;
    });

    let partners = {};
    state.previousFixtures.forEach(fixture => {
        if (seasonId !== 'all-time' && fixture.seasonId !== seasonId) return;
        fixture.games.forEach(game => {
            if (game.type === 'doubles' && game.playerIds.includes(player.id)) {
                const playerIndex = game.playerIds.indexOf(player.id);
                const partnerId = game.playerIds[1 - playerIndex];
                const partner = state.players.find(p => p.id === partnerId);
                if(partner) partners[partner.name] = (partners[partner.name] || 0) + 1;
            }
        });
    });

    const partnersHtml = Object.keys(partners).length > 0
        ? Object.entries(partners).sort((a,b) => b[1] - a[1]).map(([name, count]) => `<span class="bg-gray-200 dark:bg-gray-600 text-sm font-medium px-2 py-1 rounded">${name} (${count})</span>`).join(' ')
        : '<p class="text-sm text-gray-500 dark:text-gray-400">No doubles games played.</p>';

    return `
        <div class="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
            <h3 class="text-2xl font-bold dark:text-white">${player.name} ${player.nickname ? `"${player.nickname}"` : ''}</h3>
            <select id="player-card-season-select" class="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                ${optionsHtml}
            </select>
        </div>

        <div class="border-b border-gray-200 dark:border-gray-700">
            <nav class="-mb-px flex space-x-6" aria-label="Tabs">
                <button id="profile-tab-singles" class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm text-emerald-600 border-emerald-500">Singles</button>
                <button id="profile-tab-doubles" class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300">Doubles</button>
            </nav>
        </div>

        <div id="profile-content-singles" class="mt-4">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">Games Won</p><p class="text-2xl font-bold dark:text-white">${singlesStats.gamesWon}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">Games Lost</p><p class="text-2xl font-bold dark:text-white">${singlesStats.gamesLost}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">Legs Won</p><p class="text-2xl font-bold dark:text-white">${singlesStats.legsWon}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">Legs Lost</p><p class="text-2xl font-bold dark:text-white">${singlesStats.legsLost}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">Game Win %</p><p class="text-2xl font-bold dark:text-white">${gameWinPercent}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">Leg Win %</p><p class="text-2xl font-bold dark:text-white">${legWinPercent}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">100+</p><p class="text-2xl font-bold dark:text-white">${combinedScores.scores100}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">140+</p><p class="text-2xl font-bold dark:text-white">${combinedScores.scores140}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">180s</p><p class="text-2xl font-bold dark:text-white">${combinedScores.scores180}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">High Checkout</p><p class="text-2xl font-bold dark:text-white">${singlesStats.highCheckout}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">Outstanding Fines</p><p class="text-2xl font-bold text-red-600 dark:text-red-400">£${(singlesStats.outstandingFines / 100).toFixed(2)}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">Total Fines</p><p class="text-2xl font-bold text-red-600 dark:text-red-400">£${(singlesStats.totalFines / 100).toFixed(2)}</p></div>
            </div>
        </div>

        <div id="profile-content-doubles" class="hidden mt-4">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">Games Won</p><p class="text-2xl font-bold dark:text-white">${doublesStats.gamesWon}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">Games Lost</p><p class="text-2xl font-bold dark:text-white">${doublesStats.gamesLost}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">Legs Won</p><p class="text-2xl font-bold dark:text-white">${doublesStats.legsWon}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">Legs Lost</p><p class="text-2xl font-bold dark:text-white">${doublesStats.legsLost}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">100+</p><p class="text-2xl font-bold dark:text-white">${doublesStats.scores100}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">140+</p><p class="text-2xl font-bold dark:text-white">${doublesStats.scores140}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">180s</p><p class="text-2xl font-bold dark:text-white">${doublesStats.scores180}</p></div>
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-center flex flex-col justify-center"><p class="text-sm text-gray-600 dark:text-gray-300">High Checkout</p><p class="text-2xl font-bold dark:text-white">${doublesStats.highCheckout}</p></div>
            </div>
            <div class="mt-4">
                <h4 class="text-md font-semibold dark:text-white mb-2">Partners:</h4>
                <div class="flex flex-wrap gap-2">${partnersHtml}</div>
            </div>
        </div>
    `;
}

export function renderPlayerCard() {
    if (!state.playerCard.isOpen) {
        ui.playerCardModal.overlay.classList.add('hidden');
        ui.playerCardModal.overlay.classList.remove('flex');
        document.body.classList.remove('modal-open');
        return;
    }

    ui.playerCardModal.content.innerHTML = generatePlayerCardHTML(state.playerCard.playerId, state.playerCard.selectedSeasonId);

    ui.playerCardModal.overlay.classList.remove('hidden');
    ui.playerCardModal.overlay.classList.add('flex');
    document.body.classList.add('modal-open');

    setupProfileTabs(ui.playerCardModal.content);
}

export function renderH2HTab() {
    const playerOptions = state.players.filter(p => !p.archived).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    ui.h2h.player1Select.innerHTML = `<option value="">Select Player 1</option>${playerOptions}`;
    ui.h2h.player2Select.innerHTML = `<option value="">Select Player 2</option>${playerOptions}`;

    ui.h2h.seasonSelect.innerHTML = `<option value="all-time">All-Time</option>`;
    state.seasons.forEach(s => {
        ui.h2h.seasonSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });

    if(state.h2h.player1) ui.h2h.player1Select.value = state.h2h.player1;
    if(state.h2h.player2) ui.h2h.player2Select.value = state.h2h.player2;
    ui.h2h.seasonSelect.value = state.h2h.selectedSeason;
}

export function calculateAndRenderH2H() {
    const p1Id = state.h2h.player1;
    const p2Id = state.h2h.player2;
    const container = ui.h2h.resultsContainer;

    if (!p1Id || !p2Id || p1Id === p2Id) {
        container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Select two different players to compare their stats.</p>';
        return;
    }

    const player1 = state.players.find(p => p.id === p1Id);
    const player2 = state.players.find(p => p.id === p2Id);

    const p1Stats = getPlayerStats(player1, state.h2h.selectedSeason, 'combined');
    const p2Stats = getPlayerStats(player2, state.h2h.selectedSeason, 'combined');

    const renderStatRow = (label, val1, val2) => {
        const isP1Winner = val1 > val2;
        const isP2Winner = val2 > val1;
        return `
            <div class="flex justify-between items-center py-2">
                <span class="font-semibold ${isP1Winner ? 'text-emerald-500' : 'dark:text-white'}">${val1}</span>
                <span class="text-sm text-gray-500 dark:text-gray-400">${label}</span>
                <span class="font-semibold ${isP2Winner ? 'text-emerald-500' : 'dark:text-white'}">${val2}</span>
            </div>
        `;
    };

    container.innerHTML = `
        <div class="grid grid-cols-2 gap-4 mb-4">
             <div class="text-center p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                 <h3 class="text-lg font-bold text-emerald-600 dark:text-emerald-400">${player1.name}</h3>
             </div>
             <div class="text-center p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                 <h3 class="text-lg font-bold text-emerald-600 dark:text-emerald-400">${player2.name}</h3>
             </div>
        </div>
        <div class="divide-y divide-gray-200 dark:divide-gray-700">
            ${renderStatRow('Games Won', p1Stats.gamesWon, p2Stats.gamesWon)}
            ${renderStatRow('Legs Won', p1Stats.legsWon, p2Stats.legsWon)}
            ${renderStatRow('Leg Win %', parseFloat(((p1Stats.legsWon + p1Stats.legsLost > 0) ? (p1Stats.legsWon / (p1Stats.legsWon + p1Stats.legsLost) * 100) : 0).toFixed(1)), parseFloat(((p2Stats.legsWon + p2Stats.legsLost > 0) ? (p2Stats.legsWon / (p2Stats.legsWon + p2Stats.legsLost) * 100) : 0).toFixed(1)))}
            ${renderStatRow('100+', p1Stats.scores100, p2Stats.scores100)}
            ${renderStatRow('140+', p1Stats.scores140, p2Stats.scores140)}
            ${renderStatRow('180s', p1Stats.scores180, p2Stats.scores180)}
            ${renderStatRow('High Checkout', p1Stats.highCheckout, p2Stats.highCheckout)}
            ${renderStatRow('Total Fines (£)', (p1Stats.totalFines/100).toFixed(2), (p2Stats.totalFines/100).toFixed(2))}
        </div>
        <p class="text-xs text-center text-gray-400 mt-4">* Singles stats shown for wins/legs/HC/fines. All scores included.</p>
    `;
}

export function setupProfileTabs(container) {
    const singlesTab = container.querySelector('#profile-tab-singles');
    const doublesTab = container.querySelector('#profile-tab-doubles');
    const singlesContent = container.querySelector('#profile-content-singles');
    const doublesContent = container.querySelector('#profile-content-doubles');

    if (!singlesTab || !doublesTab || !singlesContent || !doublesContent) return;

    singlesTab.addEventListener('click', () => {
        singlesTab.classList.add('text-emerald-600', 'border-emerald-500');
        singlesTab.classList.remove('text-gray-500', 'border-transparent', 'hover:text-gray-700', 'hover:border-gray-300');
        doublesTab.classList.add('text-gray-500', 'border-transparent', 'hover:text-gray-700', 'hover:border-gray-300');
        doublesTab.classList.remove('text-emerald-600', 'border-emerald-500');
        singlesContent.classList.remove('hidden');
        doublesContent.classList.add('hidden');
    });

    doublesTab.addEventListener('click', () => {
        doublesTab.classList.add('text-emerald-600', 'border-emerald-500');
        doublesTab.classList.remove('text-gray-500', 'border-transparent', 'hover:text-gray-700', 'hover:border-gray-300');
        singlesTab.classList.add('text-gray-500', 'border-transparent', 'hover:text-gray-700', 'hover:border-gray-300');
        singlesTab.classList.remove('text-emerald-600', 'border-emerald-500');
        doublesContent.classList.remove('hidden');
        singlesContent.classList.add('hidden');
    });
}

export function renderMyProfile() {
    let selectedPlayerId = null;
    let hideSelector = false;

    if (state.isLoggedIn && state.userPlayerId) {
        selectedPlayerId = state.userPlayerId;
        state.myProfile.selectedPlayerId = state.userPlayerId;
        hideSelector = true;
    } else {
        selectedPlayerId = state.myProfile.selectedPlayerId;
    }

    if (hideSelector) {
        ui.myProfile.playerSelect.parentElement.classList.add('hidden');
    } else {
        ui.myProfile.playerSelect.parentElement.classList.remove('hidden');
        const playerOptions = state.players.filter(p => !p.archived).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        ui.myProfile.playerSelect.innerHTML = `<option value="">Select a player...</option>${playerOptions}`;
        if (selectedPlayerId) {
            ui.myProfile.playerSelect.value = selectedPlayerId;
        }
    }

    if (selectedPlayerId) {
        const player = state.players.find(p => p.id === selectedPlayerId);
        if (player) {
            ui.myProfile.nameInput.value = player.name;
            ui.myProfile.nicknameInput.value = player.nickname || '';

            if (state.userRole !== 'admin') {
                ui.myProfile.nameInput.disabled = true;
                ui.myProfile.nicknameInput.disabled = true;
                ui.myProfile.saveBtn.style.display = 'none';
            } else {
                ui.myProfile.nameInput.disabled = false;
                ui.myProfile.nicknameInput.disabled = false;
                ui.myProfile.saveBtn.style.display = 'block';
            }

            ui.myProfile.editArea.classList.remove('hidden');
            ui.myProfile.statsArea.classList.remove('hidden');

            const cardHTML = generatePlayerCardHTML(player.id, 'all-time');
            ui.myProfile.statsArea.innerHTML = cardHTML;
            ui.myProfile.statsArea.querySelector('#player-card-season-select')?.remove();
            setupProfileTabs(ui.myProfile.statsArea);
        }
    } else {
        ui.myProfile.editArea.classList.add('hidden');
        ui.myProfile.statsArea.classList.add('hidden');
    }
}

export async function handleUpdateProfile() {
    const playerId = state.myProfile.selectedPlayerId || state.userPlayerId;

    if (state.userRole !== 'admin') {
        showToast("Only admins can update player profiles.", 'error');
        return;
    }

    if (!playerId) {
        showToast("Please select a profile to update.", 'error');
        return;
    }

    const newName = ui.myProfile.nameInput.value.trim();
    const newNickname = ui.myProfile.nicknameInput.value.trim();

    if (!newName) {
        showToast("Player name cannot be empty.", 'warning');
        return;
    }

    try {
        const playerRef = doc(state.db, PLAYERS_COLLECTION, playerId);
        await updateDoc(playerRef, {
            name: newName,
            nickname: newNickname
        });
        showToast("Profile updated successfully!");
    } catch (error) {
        console.error("Error updating profile:", error);
        showToast("Could not update profile.", 'error');
    }
}