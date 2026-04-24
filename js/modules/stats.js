import { state } from '../state.js';
import { ui } from '../ui-elements.js';

export function getPlayerStats(player, seasonId, type = 'singles') {
    const defaultStats = { gamesWon: 0, gamesLost: 0, legsWon: 0, legsLost: 0, scores100: 0, scores140: 0, scores180: 0, highCheckout: 0, outstandingFines: 0, totalFines: 0 };
    if (!player || !player.stats) return defaultStats;

    const seasonsToAggregate = seasonId === 'all-time'
        ? Object.values(player.stats)
        : [player.stats[seasonId] || {}];

    const aggregated = {
        singles: { ...defaultStats },
        doubles: { ...defaultStats }
    };

    for (const seasonData of seasonsToAggregate) {
        const isNewFormat = seasonData.hasOwnProperty('singles') || seasonData.hasOwnProperty('doubles');
        const singlesData = isNewFormat ? (seasonData.singles || {}) : seasonData;
        const doublesData = isNewFormat ? (seasonData.doubles || {}) : {};

        for (const key in defaultStats) {
            if (key !== 'highCheckout') {
                aggregated.singles[key] += singlesData[key] || 0;
                aggregated.doubles[key] += doublesData[key] || 0;
            }
        }
        aggregated.singles.highCheckout = Math.max(aggregated.singles.highCheckout, singlesData.highCheckout || 0);
        aggregated.doubles.highCheckout = Math.max(aggregated.doubles.highCheckout, doublesData.highCheckout || 0);
    }

    if (type === 'singles') return aggregated.singles;
    if (type === 'doubles') return aggregated.doubles;
    if (type === 'combined') {
        return {
            gamesWon: aggregated.singles.gamesWon,
            gamesLost: aggregated.singles.gamesLost,
            legsWon: aggregated.singles.legsWon,
            legsLost: aggregated.singles.legsLost,
            scores100: aggregated.singles.scores100 + aggregated.doubles.scores100,
            scores140: aggregated.singles.scores140 + aggregated.doubles.scores140,
            scores180: aggregated.singles.scores180 + aggregated.doubles.scores180,
            highCheckout: aggregated.singles.highCheckout,
            outstandingFines: aggregated.singles.outstandingFines,
            totalFines: aggregated.singles.totalFines,
        };
    }
    return defaultStats;
}

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
        if (column !== 'gamesWon') {
            return b.displayStats.gamesWon - a.displayStats.gamesWon;
        }
        return 0;
    });

    document.querySelectorAll('#stats-table-header th[data-sort]').forEach(header => {
        const column = header.dataset.sort;
        header.style.display = state.columnVisibility[column] ? '' : 'none';
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
        
        Object.keys(columnData).forEach(column => {
            if (state.columnVisibility[column]) {
                cellsHTML += `<td class="px-2 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">${columnData[column]}</td>`;
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