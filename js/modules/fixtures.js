import { db } from '../firebase-config.js';
import { doc, updateDoc, addDoc, collection, serverTimestamp, runTransaction, Timestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from '../state.js';
import { ui } from '../ui-elements.js';
import { showToast, safeFirebaseCall, validateInput, FIXTURES_COLLECTION, PLAYERS_COLLECTION, SEASONS_COLLECTION, GAME_TITLES, triggerHaptic } from '../utils.js';
import { render, switchTab, openConfirmModal } from '../app.js'; // We will build app.js in the final step!

export function getNextUpcomingMatch(teamFilter = null) {
    if (state.upcomingFixtures.length === 0) return null;

    const now = new Date();
    const upcoming = state.upcomingFixtures
        .filter(fixture => {
            const matchDate = fixture.scheduledDate?.toDate ? fixture.scheduledDate.toDate() : new Date(fixture.scheduledDate);
            const isUpcoming = matchDate >= now;
            const matchesTeam = !teamFilter || fixture.team === teamFilter;
            return isUpcoming && matchesTeam;
        })
        .sort((a, b) => {
            const dateA = a.scheduledDate?.toDate ? a.scheduledDate.toDate() : new Date(a.scheduledDate);
            const dateB = b.scheduledDate?.toDate ? b.scheduledDate.toDate() : new Date(b.scheduledDate);
            return dateA - dateB;
        });

    return upcoming[0] || null;
}

export function renderFixturePlayerSelectors() {
    const form = ui.fixtureForm;
    form.innerHTML = '';

    let fixtureToShow = null;
    let teamToShow = null;

    if (state.userRole === 'admin') {
        const teamAFixture = state.allFixtures.find(f => f.status === 'live' && f.team === 'A');
        const teamBFixture = state.allFixtures.find(f => f.status === 'live' && f.team === 'B');

        if (teamAFixture && teamBFixture) {
            teamToShow = state.activeMatchView || 'A';
            fixtureToShow = teamToShow === 'A' ? teamAFixture : teamBFixture;
        } else if (teamAFixture) {
            teamToShow = 'A';
            fixtureToShow = teamAFixture;
        } else if (teamBFixture) {
            teamToShow = 'B';
            fixtureToShow = teamBFixture;
        }
    } else {
        fixtureToShow = state.fixture.id ? state.fixture : null;
        teamToShow = state.userTeam;
    }

    if (!fixtureToShow) {
        form.style.display = 'none';
        return;
    } else {
        form.style.display = '';
    }

    const teamPlayers = state.players.filter(p => p.team === teamToShow && !p.archived);

    GAME_TITLES.forEach((title, i) => {
        const isDoubles = title.includes("Doubles");
        const gameSetupEl = document.createElement('div');
        gameSetupEl.className = 'mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg';

        const currentGame = fixtureToShow?.games?.[i];
        const currentP1Id = currentGame?.playerIds?.[0] || '';
        const currentP2Id = currentGame?.playerIds?.[1] || '';

        const currentP1Name = currentP1Id ? (state.players.find(p => p.id === currentP1Id)?.name || '') : '';
        const currentP2Name = currentP2Id ? (state.players.find(p => p.id === currentP2Id)?.name || '') : '';

        let selectorsHtml = `
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">${title}</label>
            <div class="grid grid-cols-1 ${isDoubles ? 'sm:grid-cols-2' : ''} gap-2">
                <div class="relative">
                    <input 
                        type="text" 
                        id="game-${i}-p1-input" 
                        data-game-index="${i}"
                        data-player-slot="p1"
                        placeholder="Select or type player name"
                        value="${currentP1Name}"
                        class="player-selector-input w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        autocomplete="off">
                    <div id="game-${i}-p1-dropdown" class="player-dropdown hidden absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-lg max-h-48 overflow-y-auto"></div>
                </div>
        `;

        if (isDoubles) {
            selectorsHtml += `
                <div class="relative">
                    <input 
                        type="text" 
                        id="game-${i}-p2-input" 
                        data-game-index="${i}"
                        data-player-slot="p2"
                        placeholder="Select or type player name"
                        value="${currentP2Name}"
                        class="player-selector-input w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        autocomplete="off">
                    <div id="game-${i}-p2-dropdown" class="player-dropdown hidden absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-lg max-h-48 overflow-y-auto"></div>
                </div>
            `;
        }

        selectorsHtml += '</div>';
        gameSetupEl.innerHTML = selectorsHtml;
        form.appendChild(gameSetupEl);
    });

    setupPlayerSelectors();
}

export function setupPlayerSelectors() {
    const inputs = document.querySelectorAll('.player-selector-input');
    let teamToShow = null;

    if (state.userRole === 'admin') {
        const teamAFixture = state.allFixtures.find(f => f.status === 'live' && f.team === 'A');
        const teamBFixture = state.allFixtures.find(f => f.status === 'live' && f.team === 'B');

        if (teamAFixture && teamBFixture) {
            teamToShow = state.activeMatchView || 'A';
        } else if (teamAFixture) {
            teamToShow = 'A';
        } else if (teamBFixture) {
            teamToShow = 'B';
        }
    } else {
        teamToShow = state.userTeam;
    }

    const teamPlayers = state.players.filter(p => p.team === teamToShow);

    inputs.forEach(input => {
        const gameIndex = input.dataset.gameIndex;
        const playerSlot = input.dataset.playerSlot;
        const dropdown = document.getElementById(`game-${gameIndex}-${playerSlot}-dropdown`);

        input.addEventListener('focus', () => {
            showPlayerDropdown(input, dropdown, teamPlayers, '');
        });

        input.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            showPlayerDropdown(input, dropdown, teamPlayers, searchTerm);
        });

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    });
}

export function showPlayerDropdown(input, dropdown, players, searchTerm) {
    const filtered = players.filter(p => 
        p.name.toLowerCase().includes(searchTerm) && !p.archived
    );

    dropdown.innerHTML = '';

    if (searchTerm && !filtered.find(p => p.name.toLowerCase() === searchTerm)) {
        const customOption = document.createElement('div');
        customOption.className = 'px-3 py-2 hover:bg-emerald-100 dark:hover:bg-emerald-900 cursor-pointer border-b border-gray-200 dark:border-gray-700';
        customOption.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400 font-medium">+ Add "${searchTerm}" as new player</span>`;
        customOption.addEventListener('click', () => {
            input.value = searchTerm;
            dropdown.classList.add('hidden');
        });
        dropdown.appendChild(customOption);
    }

    if (filtered.length > 0) {
        filtered.forEach(player => {
            const option = document.createElement('div');
            option.className = 'px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer';
            option.textContent = player.name;
            option.addEventListener('click', () => {
                input.value = player.name;
                dropdown.classList.add('hidden');
            });
            dropdown.appendChild(option);
        });
    } else if (!searchTerm) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'px-3 py-2 text-gray-500 dark:text-gray-400 text-sm';
        emptyMsg.textContent = 'No players available. Type to add new player.';
        dropdown.appendChild(emptyMsg);
    }

    dropdown.classList.remove('hidden');
}

export function renderFixtureSetup() {
    const isDisabled = state.userRole === 'viewer' || state.userRole === 'scorer' || (!state.userTeam && state.isLoggedIn && state.userRole !== 'viewer');

    let activeFixtureForTeam = null;
    let teamToShow = null;
    let bothTeamsHaveMatches = false;

    if (state.userRole === 'admin') {
        const teamAFixture = state.allFixtures.find(f => f.status === 'live' && f.team === 'A');
        const teamBFixture = state.allFixtures.find(f => f.status === 'live' && f.team === 'B');

        bothTeamsHaveMatches = teamAFixture && teamBFixture;

        if (bothTeamsHaveMatches) {
            teamToShow = state.activeMatchView || 'A';
            activeFixtureForTeam = teamToShow === 'A' ? teamAFixture : teamBFixture;
        } else if (teamAFixture) {
            teamToShow = 'A';
            activeFixtureForTeam = teamAFixture;
        } else if (teamBFixture) {
            teamToShow = 'B';
            activeFixtureForTeam = teamBFixture;
        }
    } else {
        activeFixtureForTeam = state.fixture.id ? state.fixture : null;
        teamToShow = state.userTeam;
    }

    const hasActiveFixture = activeFixtureForTeam !== null;

    const teamSwitcher = document.getElementById('setup-team-switcher');
    if (teamSwitcher) {
        if (state.userRole === 'admin' && bothTeamsHaveMatches) {
            teamSwitcher.classList.remove('hidden');
            teamSwitcher.classList.add('flex');
            // updateTeamSwitcherStyles('setup'); -> called in render() usually
        } else {
            teamSwitcher.classList.add('hidden');
            teamSwitcher.classList.remove('flex');
        }
    }

    if (state.userRole === 'admin' && !hasActiveFixture) {
        const existingNoMatchWarning = document.getElementById('admin-no-match-warning');
        if (existingNoMatchWarning) existingNoMatchWarning.remove();

        const warningDiv = document.createElement('div');
        warningDiv.id = 'admin-no-match-warning';
        warningDiv.className = 'col-span-2 p-4 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-center mb-4';
        warningDiv.innerHTML = `
            <p class="font-semibold text-blue-900 dark:text-blue-100">No Active Matches</p>
            <p class="text-sm text-blue-800 dark:text-blue-200">Create a match in the Match tab to set up teams.</p>
        `;
        if (ui.fixtureForm.parentElement) {
            ui.fixtureForm.parentElement.insertBefore(warningDiv, ui.fixtureForm);
        }
    } else {
        const existingNoMatchWarning = document.getElementById('admin-no-match-warning');
        if (existingNoMatchWarning) existingNoMatchWarning.remove();
    }

    if (!state.userTeam && state.isLoggedIn && state.userRole !== 'viewer') {
        ui.oppositionNameInput.disabled = true;
        ui.matchDateInput.disabled = true;
        const warningDiv = document.createElement('div');
        warningDiv.className = 'col-span-2 p-4 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 text-center mb-4';
        warningDiv.innerHTML = `
            <p class="font-semibold text-yellow-900 dark:text-yellow-100">No Team Assigned</p>
            <p class="text-sm text-yellow-800 dark:text-yellow-200">Contact an admin to assign you to a team.</p>
        `;
        if (ui.fixtureForm.parentElement && !document.getElementById('no-team-warning')) {
            warningDiv.id = 'no-team-warning';
            ui.fixtureForm.parentElement.insertBefore(warningDiv, ui.fixtureForm);
        }
    } else {
        const existingWarning = document.getElementById('no-team-warning');
        if (existingWarning) existingWarning.remove();
    }

    document.querySelectorAll('#tab-content-setup input:not(#opposition-name-input):not(#match-date-input), #tab-content-setup select').forEach(el => {
        el.disabled = isDisabled;
    });

    if (hasActiveFixture) {
        ui.oppositionNameInput.style.display = '';
        ui.matchDateInput.style.display = '';
        ui.createFixtureBtn.style.display = 'none';

        const cancelBtn = document.getElementById('cancel-match-btn');
        if (cancelBtn) {
            cancelBtn.style.display = isDisabled ? 'none' : 'block';
        }

        let updateBtn = document.getElementById('update-teams-btn');
        if (!updateBtn) {
            updateBtn = document.createElement('button');
            updateBtn.id = 'update-teams-btn';
            updateBtn.className = 'w-full bg-blue-600 text-white py-3 px-4 rounded-xl hover:bg-blue-700 transition-colors duration-200 font-semibold text-lg';
            updateBtn.textContent = 'Update Team Selections';
            ui.createFixtureBtn.parentNode.insertBefore(updateBtn, ui.createFixtureBtn.nextSibling);

            updateBtn.addEventListener('click', updateTeamSelections);
        }
        updateBtn.style.display = isDisabled ? 'none' : 'block';

        ui.oppositionNameInput.disabled = true;
        ui.matchDateInput.disabled = true;

        if (activeFixtureForTeam) {
            ui.oppositionNameInput.value = activeFixtureForTeam.oppositionName;
            if (activeFixtureForTeam.scheduledDate) {
                const matchDate = activeFixtureForTeam.scheduledDate.toDate();
                ui.matchDateInput.value = matchDate.toISOString().split('T')[0];
            }
        }
    } else {
        if (state.userRole === 'admin') {
            ui.createFixtureBtn.style.display = 'none';
            ui.oppositionNameInput.style.display = 'none';
            ui.matchDateInput.style.display = 'none';
            const updateBtn = document.getElementById('update-teams-btn');
            if (updateBtn) updateBtn.style.display = 'none';
            const cancelBtn = document.getElementById('cancel-match-btn');
            if (cancelBtn) cancelBtn.style.display = 'none';
        } else {
            ui.createFixtureBtn.style.display = 'block';
            ui.oppositionNameInput.style.display = '';
            ui.matchDateInput.style.display = '';
            const updateBtn = document.getElementById('update-teams-btn');
            if (updateBtn) updateBtn.style.display = 'none';

            const cancelBtn = document.getElementById('cancel-match-btn');
            if (cancelBtn) {
                cancelBtn.style.display = 'none';
            }

            ui.oppositionNameInput.disabled = isDisabled;
            ui.matchDateInput.disabled = isDisabled;

            if (isDisabled) {
                ui.createFixtureBtn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                ui.createFixtureBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    }
}

export function renderOverallScore(container, fixture = state.fixture) {
    container.innerHTML = '';
    if (!fixture.id) return;

    let burnabyLegs = 0;
    let oppositionLegs = 0;
    fixture.games.forEach(game => {
        burnabyLegs += game.legsWon || 0;
        oppositionLegs += game.legsLost || 0;
    });

    const scoreEl = document.createElement('div');
    scoreEl.className = 'p-4 bg-emerald-600 text-white rounded-xl';
    scoreEl.innerHTML = `<h3 class="text-xl sm:text-2xl font-bold text-center">Total Legs: ${burnabyLegs} - ${oppositionLegs}</h3>`;
    container.appendChild(scoreEl);
}

export function renderCurrentMatch() {
    if (!state.userTeam && state.isLoggedIn && state.userRole !== 'viewer') {
        ui.currentMatchOpponent.textContent = 'Team Assignment Required';
        ui.currentMatchResults.innerHTML = `
            <div class="p-6 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 text-center">
                <svg class="w-16 h-16 mx-auto mb-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <p class="font-semibold text-lg text-yellow-900 dark:text-yellow-100 mb-2">No Team Assigned</p>
                <p class="text-yellow-800 dark:text-yellow-200">Please contact an admin to assign you to A Team or B Team.</p>
            </div>
        `;
        ui.currentMatchScoreContainer.innerHTML = '';
        return;
    }

    const teamFixtures = (state.allFixtures || []).filter(f => f.team === state.activeMatchView);
    const activeFixture = teamFixtures.find(f => f.status === 'live');

    if (!activeFixture && !state.fixture.id) {
        ui.currentMatchOpponent.textContent = 'Live results as they come in.';
        const nextMatch = getNextUpcomingMatch(state.activeMatchView);
        if (nextMatch) {
            const matchDate = nextMatch.scheduledDate?.toDate ? nextMatch.scheduledDate.toDate() : new Date(nextMatch.scheduledDate);
            ui.currentMatchResults.innerHTML = `
                <p class="text-gray-500 dark:text-gray-400 mb-4">No active match.</p>
                <div class="p-4 rounded-xl bg-blue-100 dark:bg-blue-800/60 text-center">
                    <p class="font-semibold dark:text-white">Next Match</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">vs ${nextMatch.oppositionName}</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">${matchDate.toLocaleDateString()}</p>
                    ${nextMatch.venue ? `<p class="text-sm text-gray-600 dark:text-gray-400">${nextMatch.venue}</p>` : ''}
                </div>
            `;
        } else {
            ui.currentMatchResults.innerHTML = `
                <p class="text-gray-500 dark:text-gray-400">No active match.</p>
                <div class="p-4 rounded-xl bg-blue-100 dark:bg-blue-800/60 text-center">
                 <p class="font-semibold dark:text-white">No Upcoming Matches</p>
                </div>
            `;
        }
        ui.currentMatchScoreContainer.innerHTML = '';
        return;
    }

    let displayFixture = activeFixture;
    if (!displayFixture && state.fixture.id && state.fixture.team === state.activeMatchView) {
        displayFixture = state.fixture;
    }

    if (!displayFixture) {
        ui.currentMatchOpponent.textContent = 'Live results as they come in.';
        const nextMatch = getNextUpcomingMatch(state.activeMatchView);
        if (nextMatch) {
            const matchDate = nextMatch.scheduledDate?.toDate ? nextMatch.scheduledDate.toDate() : new Date(nextMatch.scheduledDate);
            ui.currentMatchResults.innerHTML = `
                <p class="text-gray-500 dark:text-gray-400 mb-4">No active match.</p>
                <div class="p-4 rounded-xl bg-blue-100 dark:bg-blue-800/60 text-center">
                    <p class="font-semibold dark:text-white">Next Match</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">vs ${nextMatch.oppositionName}</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">${matchDate.toLocaleDateString()}</p>
                    ${nextMatch.venue ? `<p class="text-sm text-gray-600 dark:text-gray-400">${nextMatch.venue}</p>` : ''}
                </div>
            `;
        } else {
            ui.currentMatchResults.innerHTML = `
                <p class="text-gray-500 dark:text-gray-400">No active match.</p>
                <div class="p-4 rounded-xl bg-blue-100 dark:bg-blue-800/60 text-center">
                 <p class="font-semibold dark:text-white">No Upcoming Matches</p>
                </div>
            `;
        }
        ui.currentMatchScoreContainer.innerHTML = '';
        return;
    }

    ui.currentMatchOpponent.textContent = `vs ${displayFixture.oppositionName}`;
    ui.currentMatchResults.innerHTML = '';

    renderOverallScore(ui.currentMatchScoreContainer, displayFixture);

    displayFixture.games.forEach((game, index) => {
        const gameEl = document.createElement('div');
        gameEl.className = `p-4 rounded-xl ${state.currentGameIndex === index ? 'bg-emerald-100 dark:bg-emerald-800/60' : 'bg-gray-50 dark:bg-gray-700/50'}`;
        const playerNames = game.playerIds.map(id => state.players.find(p => p.id === id)?.name || 'Unknown').join(' & ');
        gameEl.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <p class="font-bold dark:text-white">${game.title}</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">${playerNames}</p>
                </div>
                <p class="text-xl font-bold dark:text-white">${game.legsWon || 0} - ${game.legsLost || 0}</p>
            </div>
        `;
        ui.currentMatchResults.appendChild(gameEl);
    });
}

export function renderFixturesTab() {
    if (state.activeFixturesTab === 'upcoming') {
        ui.fixturesTabUpcoming.classList.add('text-emerald-600', 'border-emerald-500');
        ui.fixturesTabUpcoming.classList.remove('text-gray-500', 'border-transparent');
        ui.fixturesTabPrevious.classList.add('text-gray-500', 'border-transparent');
        ui.fixturesTabPrevious.classList.remove('text-emerald-600', 'border-emerald-500');
        ui.fixturesContentUpcoming.classList.remove('hidden');
        ui.fixturesContentPrevious.classList.add('hidden');
    } else {
        ui.fixturesTabPrevious.classList.add('text-emerald-600', 'border-emerald-500');
        ui.fixturesTabPrevious.classList.remove('text-gray-500', 'border-transparent');
        ui.fixturesTabUpcoming.classList.add('text-gray-500', 'border-transparent');
        ui.fixturesTabUpcoming.classList.remove('text-emerald-600', 'border-emerald-500');
        ui.fixturesContentPrevious.classList.remove('hidden');
        ui.fixturesContentUpcoming.classList.add('hidden');
    }

    renderUpcomingFixtures();
    renderPreviousFixtures();
}

export function renderUpcomingFixtures() {
    ui.upcomingFixturesList.innerHTML = '';
    ui.addFixtureBtn.classList.toggle('hidden', state.userRole === 'viewer' || state.userRole === 'scorer');

    const teamFixtures = state.upcomingFixtures.filter(f => f.team === state.activeMatchView);

    if (teamFixtures.length === 0) {
        ui.upcomingFixturesList.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No upcoming matches.</p>';
        return;
    }

    teamFixtures.forEach(fixture => {
        const item = document.createElement('div');
        item.className = `w-full text-left p-3 rounded-lg transition-colors duration-200 ${state.selectedUpcomingFixtureId === fixture.id ? 'bg-emerald-100 dark:bg-emerald-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`;

        const isAdmin = state.userRole === 'admin';
        const canStartMatch = state.userRole === 'admin' || state.userRole === 'member';
        const scheduledDate = fixture.scheduledDate?.toDate ? fixture.scheduledDate.toDate() : new Date(fixture.scheduledDate);

        item.innerHTML = `
            <div class="flex justify-between items-center">
                <button class="flex-grow text-left select-upcoming-match-btn" data-fixture-id="${fixture.id}">
                    <p class="font-semibold dark:text-white">vs ${fixture.oppositionName} ${fixture.location ? `(${fixture.location})` : ''}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${scheduledDate.toLocaleDateString()}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                    ${fixture.venue ? (fixture.address ? `<a href="https://www.google.com/maps/place/$${encodeURIComponent(fixture.address)}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700 underline cursor-pointer" title="View location on Google Maps">${fixture.venue}</a>` : fixture.venue) : 'TBD'}
                    </p>
                </button>
                <div class="flex items-center space-x-2 flex-shrink-0">
                    ${canStartMatch ? `<button data-fixture-id="${fixture.id}" class="start-match-btn bg-emerald-600 text-white px-3 py-1 rounded text-sm hover:bg-emerald-700">Start Match</button>` : ''}
                    ${isAdmin ? `<button data-fixture-id="${fixture.id}" class="delete-upcoming-fixture-btn text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>` : ''}
                </div>
            </div>
        `;
        ui.upcomingFixturesList.appendChild(item);
    });
}

export function renderPreviousFixtures() {
    ui.previousFixturesList.innerHTML = '';
    const teamFixtures = state.previousFixtures.filter(f => f.team === state.activeMatchView);
    if (teamFixtures.length === 0) {
        ui.previousFixturesList.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No finished matches.</p>';
        return;
    }

    teamFixtures.forEach(fixture => {
        let burnabyLegs = 0;
        let oppositionLegs = 0;
        fixture.games.forEach(game => {
            burnabyLegs += game.legsWon || 0;
            oppositionLegs += game.legsLost || 0;
        });

        const item = document.createElement('div');
        item.className = `w-full text-left p-3 rounded-lg transition-colors duration-200 ${state.selectedPreviousFixtureId === fixture.id ? 'bg-emerald-100 dark:bg-emerald-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`;

        const isAdmin = state.userRole === 'admin';
        const matchDate = fixture.scheduledDate?.toDate ? fixture.scheduledDate.toDate() : fixture.createdAt?.toDate();

        item.innerHTML = `
            <div class="flex justify-between items-center">
                <button class="flex-grow text-left select-previous-match-btn" data-fixture-id="${fixture.id}">
                    <p class="font-semibold dark:text-white">vs ${fixture.oppositionName}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${matchDate?.toLocaleDateString() || 'Unknown date'}</p>
                </button>
                <div class="flex items-center space-x-2 flex-shrink-0">
                    <p class="font-bold text-lg dark:text-white">${burnabyLegs} - ${oppositionLegs}</p>
                    ${isAdmin ? `<button data-fixture-id="${fixture.id}" class="delete-previous-fixture-btn text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>` : ''}
                </div>
            </div>
        `;
        ui.previousFixturesList.appendChild(item);
    });
}

export function openFixtureModal(fixtureId, type) {
    const fixture = type === 'upcoming'
        ? state.upcomingFixtures.find(f => f.id === fixtureId)
        : state.previousFixtures.find(f => f.id === fixtureId);

    if (!fixture) return;

    const scheduledDate = fixture.scheduledDate?.toDate ? fixture.scheduledDate.toDate() : new Date(fixture.scheduledDate);
    const isAdmin = state.userRole === 'admin';
    const canEdit = isAdmin || state.userRole === 'member';

    let modalContent = '';

    if (type === 'upcoming' && canEdit) {
        modalContent = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-2xl font-bold dark:text-white">Edit Fixture</h3>
            </div>
            <div class="space-y-4">
                ${isAdmin ? `
                <div>
                    <label for="edit-fixture-team" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team</label>
                    <select id="edit-fixture-team" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                        <option value="A" ${fixture.team === 'A' ? 'selected' : ''}>Team A</option>
                        <option value="B" ${fixture.team === 'B' ? 'selected' : ''}>Team B</option>
                    </select>
                </div>
                ` : ''}
                <div>
                    <label for="edit-fixture-opposition" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Opposition</label>
                    <input type="text" id="edit-fixture-opposition" value="${fixture.oppositionName}" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                </div>
                <div>
                    <label for="edit-fixture-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Match Date</label>
                    <input type="date" id="edit-fixture-date" value="${scheduledDate.toISOString().split('T')[0]}" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                </div>
                <div>
                    <label for="edit-fixture-location" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                    <select id="edit-fixture-location" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                        <option value="Away" ${fixture.location === 'Away' ? 'selected' : ''}>Away</option>
                        <option value="Home" ${fixture.location === 'Home' ? 'selected' : ''}>Home</option>
                    </select>
                </div>
                <div>
                    <label for="edit-fixture-venue" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Venue</label>
                    <input type="text" id="edit-fixture-venue" value="${fixture.venue || ''}" placeholder="e.g., The King's Arms" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                </div>
                <div id="edit-fixture-address-container" ${fixture.location === 'Home' ? 'style="display:none;"' : ''}>
                    <label for="edit-fixture-address" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Address (for maps)</label>
                    <input type="text" id="edit-fixture-address" value="${fixture.address || ''}" placeholder="e.g., 123 High Street, Burnaby Village, BC V5A 1A1" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                </div>
                <div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p class="text-sm text-gray-600 dark:text-gray-400">Season</p>
                    <p class="font-semibold dark:text-white">${state.seasons.find(s => s.id === fixture.seasonId)?.name || 'Unknown'}</p>
                </div>
                <div class="flex justify-end space-x-3 mt-6">
                    <button id="cancel-edit-fixture" class="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-xl">Cancel</button>
                    <button id="save-edit-fixture" data-fixture-id="${fixtureId}" class="bg-emerald-600 text-white py-2 px-4 rounded-xl hover:bg-emerald-700 transition-colors">Save Changes</button>
                </div>
            </div>
        `;
    } else {
        modalContent = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-2xl font-bold dark:text-white">vs ${fixture.oppositionName}</h3>
            </div>
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p class="text-sm text-gray-600 dark:text-gray-400">Date</p>
                        <p class="font-semibold dark:text-white">${scheduledDate.toLocaleDateString()}</p>
                    </div>
                    <div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p class="text-sm text-gray-600 dark:text-gray-400">Season</p>
                        <p class="font-semibold dark:text-white">${state.seasons.find(s => s.id === fixture.seasonId)?.name || 'Unknown'}</p>
                    </div>
                </div>
        `;

        if (fixture.venue || fixture.location) {
            modalContent += `
                <div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p class="text-sm text-gray-600 dark:text-gray-400">Venue</p>
                    <p class="font-semibold dark:text-white">
                        ${fixture.venue ? (fixture.address ? `<a href="https://www.google.com/maps/place/$${encodeURIComponent(fixture.address)}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700 underline cursor-pointer" title="View location on Google Maps">${fixture.venue}</a>` : fixture.venue) : 'TBD'}
                        ${fixture.location ? `(${fixture.location})` : ''}
                    </p>
                </div>
            `;
        }

        if (type === 'previous') {
            let burnabyLegs = 0;
            let oppositionLegs = 0;
            fixture.games.forEach(game => {
                burnabyLegs += game.legsWon || 0;
                oppositionLegs += game.legsLost || 0;
            });

            modalContent += `
                <div class="p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                    <p class="text-sm text-gray-600 dark:text-gray-400">Final Score</p>
                    <p class="font-bold text-xl dark:text-white">${burnabyLegs} - ${oppositionLegs}</p>
                </div>
                <div class="space-y-2">
                    <h4 class="font-semibold dark:text-white">Game Results</h4>
            `;

            fixture.games.forEach(game => {
                const playerNames = game.playerIds.map(id => state.players.find(p => p.id === id)?.name || 'Unknown').join(' & ');
                modalContent += `
                    <div class="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <div>
                            <p class="font-medium dark:text-white">${game.title}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400">${playerNames}</p>
                        </div>
                        <p class="font-bold dark:text-white">${game.legsWon} - ${game.legsLost}</p>
                    </div>
                `;
            });
            modalContent += '</div>';
        }
        modalContent += '</div>';
    }

    ui.playerCardModal.content.innerHTML = modalContent;
    ui.playerCardModal.overlay.classList.remove('hidden');
    ui.playerCardModal.overlay.classList.add('flex');
    document.body.classList.add('modal-open');
}

export function closeFixtureModal() {
    ui.playerCardModal.overlay.classList.add('hidden');
    ui.playerCardModal.overlay.classList.remove('flex');
    document.body.classList.remove('modal-open');
}

export async function saveFixtureEdit(fixtureId) {
    const opposition = validateInput(document.getElementById('edit-fixture-opposition').value);
    const date = document.getElementById('edit-fixture-date').value;
    const location = document.getElementById('edit-fixture-location').value;
    const venue = document.getElementById('edit-fixture-venue').value.trim();
    const address = document.getElementById('edit-fixture-address').value.trim();
    const team = document.getElementById('edit-fixture-team')?.value;

    if (!opposition) {
        showToast("Opposition name cannot be empty.", 'warning');
        return;
    }
    if (!date) {
        showToast("Match date cannot be empty.", 'warning');
        return;
    }

    try {
        const scheduledDate = Timestamp.fromDate(new Date(date));
        const updates = {
            oppositionName: opposition,
            scheduledDate: scheduledDate,
            location: location,
            venue: venue || null,
            address: address || null
        };

        if (team && state.userRole === 'admin') {
            updates.team = team;
        }

        await safeFirebaseCall('updateFixture', async () => {
            const fixtureRef = doc(state.db, FIXTURES_COLLECTION, fixtureId);
            return await updateDoc(fixtureRef, updates);
        });

        showToast("Fixture updated successfully!");
        closeFixtureModal();
    } catch (error) {
        if (error.message.includes('Rate limit') || error.message.includes('Invalid characters') || error.message.includes('Input too long')) {
            showToast(error.message, 'error');
        } else {
            console.error("Error updating fixture:", error);
            showToast("Could not update fixture.", 'error');
        }
    }
}

export async function addScheduledFixture() {
    if (state.userRole === 'viewer' || state.userRole === 'scorer') {
        showToast("You don't have permission to add fixtures.", 'error');
        return;
    }
    if (!state.isLoggedIn) {
        showToast("You must be logged in to add a fixture.", 'error');
        return;
    }
    if (!state.activeSeasonId) {
        showToast("Please set an active season before adding a fixture.", 'warning');
        return;
    }

    showAddFixtureModal();
}

export function showAddFixtureModal() {
    const modal = document.createElement('div');
    modal.id = 'add-fixture-modal';
    modal.className = 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4';
    const isAdmin = state.userRole === 'admin';

    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-semibold dark:text-white">Add Fixture</h3>
                <button id="add-fixture-close" class="text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white text-2xl leading-none">×</button>
            </div>
            <div class="space-y-4">
                ${isAdmin ? `
                <div>
                    <label for="fixture-team-select" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team</label>
                    <select id="fixture-team-select" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                        <option value="A" ${state.activeMatchView === 'A' ? 'selected' : ''}>Team A</option>
                        <option value="B" ${state.activeMatchView === 'B' ? 'selected' : ''}>Team B</option>
                    </select>
                </div>
                ` : ''}
                <div>
                    <label for="fixture-location" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                    <select id="fixture-location" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                        <option value="Away">Away</option>
                        <option value="Home">Home</option>
                    </select>
                </div>
                <div>
                    <label for="fixture-opposition" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Opposition</label>
                    <input type="text" id="fixture-opposition" placeholder="e.g., The King's Arms" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                </div>
                <div>
                    <label for="fixture-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Match Date</label>
                    <input type="date" id="fixture-date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                </div>
                <div>
                    <label for="fixture-venue" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Venue (optional)</label>
                    <input type="text" id="fixture-venue" placeholder="e.g., The King's Arms" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                </div>
                <div id="fixture-address-container">
                    <label for="fixture-address" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Address (for maps)</label>
                    <input type="text" id="fixture-address" placeholder="e.g., 123 High Street, Burnaby Village, BC V5A 1A1" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                </div>
                <div class="flex justify-end space-x-3 mt-6">
                    <button id="add-fixture-cancel" class="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-xl">Cancel</button>
                    <button id="add-fixture-submit" class="bg-emerald-600 text-white py-2 px-4 rounded-xl hover:bg-emerald-700 transition-colors">Add Fixture</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    document.getElementById('fixture-date').value = new Date().toISOString().split('T')[0];

    document.getElementById('add-fixture-close').addEventListener('click', closeAddFixtureModal);
    document.getElementById('add-fixture-cancel').addEventListener('click', closeAddFixtureModal);
    document.getElementById('add-fixture-submit').addEventListener('click', submitAddFixture);
    
    document.getElementById('fixture-location').addEventListener('change', (e) => {
        const addressContainer = document.getElementById('fixture-address-container');
        const addressInput = document.getElementById('fixture-address');
        const venueInput = document.getElementById('fixture-venue');

        if (e.target.value === 'Home') {
            addressContainer.style.display = 'none';
            addressInput.value = '';
            venueInput.value = 'The Burnaby Arms';
        } else {
            addressContainer.style.display = 'block';
            if (venueInput.value === 'The Burnaby Arms') {
                venueInput.value = '';
            }
        }
    });
}

export function closeAddFixtureModal() {
    const modal = document.getElementById('add-fixture-modal');
    if (modal) {
        modal.remove();
        document.body.classList.remove('modal-open');
    }
}

export async function submitAddFixture() {
    const oppositionName = validateInput(document.getElementById('fixture-opposition').value);
    const fixtureDate = document.getElementById('fixture-date').value;
    const venue = document.getElementById('fixture-venue').value.trim();
    const location = document.getElementById('fixture-location').value;
    const address = document.getElementById('fixture-address').value.trim();

    if (!oppositionName) {
        showToast("Please enter an opposition name.", 'warning');
        return;
    }
    if (!fixtureDate) {
        showToast("Please select a match date.", 'warning');
        return;
    }

    const fixtureTeam = state.userRole === 'admin'
        ? document.getElementById('fixture-team-select')?.value || state.userTeam
        : state.userTeam;

    if (!fixtureTeam) {
        showToast("Please select a team for this fixture.", 'warning');
        return;
    }

    try {
        const scheduledDate = Timestamp.fromDate(new Date(fixtureDate));

        const games = GAME_TITLES.map((title) => {
            const isDoubles = title.includes("Doubles");
            return {
                title: title,
                type: isDoubles ? 'doubles' : 'singles',
                playerIds: [],
                legsWon: 0,
                legsLost: 0,
                highCheckout: 0,
                fines: 0,
                finesList: [],
                playerScores: []
            };
        });

        await safeFirebaseCall('addScheduledFixture', async () => {
            return await addDoc(collection(state.db, FIXTURES_COLLECTION), {
                seasonId: state.activeSeasonId,
                team: fixtureTeam,
                oppositionName: oppositionName,
                scheduledDate: scheduledDate,
                venue: venue || null,
                location: location,
                address: address || null,
                games: games,
                status: 'scheduled',
                createdAt: serverTimestamp()
            });
        });

        showToast(`Fixture against ${oppositionName} added!`);
        closeAddFixtureModal();
    } catch (error) {
        if (error.message.includes('Rate limit') || error.message.includes('Invalid characters') || error.message.includes('Input too long')) {
            showToast(error.message, 'error');
        } else {
            console.error("Error adding fixture:", error);
            showToast("Could not add fixture.", 'error');
        }
    }
}

export async function startMatchFromScheduled(fixtureId) {
    if (state.userRole === 'viewer' || state.userRole === 'scorer') {
        showToast("You don't have permission to start matches.", 'error');
        return;
    }

    const scheduledFixture = state.upcomingFixtures.find(f => f.id === fixtureId);
    if (!scheduledFixture) {
        showToast("Fixture not found.", 'error');
        return;
    }

    try {
        const games = GAME_TITLES.map((title) => {
            const isDoubles = title.includes("Doubles");
            return {
                title: title,
                type: isDoubles ? 'doubles' : 'singles',
                playerIds: [],
                legsWon: 0,
                legsLost: 0,
                highCheckout: 0,
                fines: 0,
                finesList: [],
                playerScores: []
            };
        });

        await safeFirebaseCall('startMatch', async () => {
            const fixtureRef = doc(state.db, FIXTURES_COLLECTION, fixtureId);
            return await updateDoc(fixtureRef, {
                status: 'live',
                games: games,
                activeGameIndex: 0,
                createdAt: serverTimestamp() 
            });
        });

        ui.oppositionNameInput.value = scheduledFixture.oppositionName;
        if (scheduledFixture.scheduledDate) {
            const matchDate = scheduledFixture.scheduledDate.toDate();
            ui.matchDateInput.value = matchDate.toISOString().split('T')[0];
        }

        showToast("Match started! Please set up your team.", 'success');
        render();
        switchTab('setup');
    } catch (error) {
        if (error.message.includes('Rate limit')) {
            showToast(error.message, 'error');
        } else {
            console.error("Error starting match:", error);
            showToast("Could not start the match.", 'error');
        }
    }
}

export function deleteUpcomingFixture(fixtureId) {
    const fixture = state.upcomingFixtures.find(f => f.id === fixtureId);
    if (!fixture) return;
    openConfirmModal(
        'Delete Fixture?',
        `Are you sure you want to delete the fixture against ${fixture.oppositionName}? This action cannot be undone.`,
        'deleteUpcomingFixture',
        fixtureId
    );
}

export function deletePreviousFixture(fixtureId) {
    const fixture = state.previousFixtures.find(f => f.id === fixtureId);
    if (!fixture) return;
    openConfirmModal(
        'Delete Match?',
        `Are you sure you want to delete the match against ${fixture.oppositionName}? This action cannot be undone.`,
        'deletePreviousFixture',
        fixtureId
    );
}

export async function getOrCreatePlayer(nameInput) {
    const trimmedName = nameInput.trim();
    if (!trimmedName) return null;

    const existingById = state.players.find(p => p.id === trimmedName);
    if (existingById) return trimmedName;

    const existingByName = state.players.find(p => p.name.toLowerCase() === trimmedName.toLowerCase());
    if (existingByName) return existingByName.id;

    try {
        const docRef = await safeFirebaseCall('createPlayer', async () => {
            return await addDoc(collection(state.db, PLAYERS_COLLECTION), {
                name: trimmedName,
                nickname: '',
                team: state.userTeam,
                stats: {},
                isTemporary: true 
            });
        });

        showToast(`${trimmedName} added to roster.`);
        return docRef.id;
    } catch (error) {
        if (error.message.includes('Rate limit')) {
            showToast(error.message, 'error');
        } else {
            console.error("Error creating player:", error);
            showToast("Could not create player.", 'error');
        }
        return null;
    }
}

export async function createFixture() {
    triggerHaptic('medium');
    if (state.userRole === 'viewer' || state.userRole === 'scorer') {
        showToast("You don't have permission to create matches.", 'error');
        return;
    }
    if (!state.isLoggedIn) {
        showToast("You must be logged in to create a match.", 'error');
        return;
    }
    if (!state.activeSeasonId) {
        showToast("Please set an active season before creating a match.", 'warning');
        return;
    }
    
    const oppositionName = ui.oppositionNameInput.value.trim();
    if(!oppositionName) {
        showToast("Please enter an opposition name.", 'warning');
        return;
    }

    const dateValue = ui.matchDateInput.value;
    let createdAt;

    if (dateValue) {
        const parts = dateValue.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const selectedDate = new Date(year, month, day);
        createdAt = Timestamp.fromDate(selectedDate);
    } else {
        createdAt = serverTimestamp();
    }

    const games = [];
    for (let i = 0; i < GAME_TITLES.length; i++) {
        const title = GAME_TITLES[i];
        const isDoubles = title.includes("Doubles");

        const p1Input = document.getElementById(`game-${i}-p1-input`);
        const p1Value = p1Input.value.trim();
        const p1Id = await getOrCreatePlayer(p1Value);
        
        if (!p1Id && p1Value) {
            showToast(`Could not add player for ${title}.`, 'error');
            return;
        }

        const playerIds = p1Id ? [p1Id] : [];

        if (isDoubles) {
            const p2Input = document.getElementById(`game-${i}-p2-input`);
            const p2Value = p2Input.value.trim();
            const p2Id = await getOrCreatePlayer(p2Value);

            if (p1Id && p2Id && p1Id === p2Id) {
                showToast(`A player cannot play with themselves in ${title}.`, 'error');
                return;
            }

            if (p2Id) playerIds.push(p2Id);
        }

        const playerScores = playerIds.map(() => ({
            scores100: 0,
            scores140: 0,
            scores180: 0,
            sillyThings: 0,
        }));

        games.push({
            title: title,
            type: isDoubles ? 'doubles' : 'singles',
            playerIds: playerIds,
            legsWon: 0,
            legsLost: 0,
            highCheckout: 0,
            fines: 0,
            finesList: [],
            playerScores: playerScores
        });
    }

    try {
        const fixtureTeam = state.userRole === 'admin' ? state.activeMatchView : state.userTeam;

        await safeFirebaseCall('createFixture', async () => {
            return await addDoc(collection(state.db, FIXTURES_COLLECTION), {
                seasonId: state.activeSeasonId,
                team: fixtureTeam, 
                oppositionName: oppositionName,
                games: games,
                activeGameIndex: 0,
                status: 'live',
                createdAt: createdAt,
                scheduledDate: createdAt
            });
        });
        
        showToast("Fixture created! Let's play darts!");
        ui.oppositionNameInput.value = '';
        ui.matchDateInput.value = '';
        switchTab('live');
    } catch (error) {
        console.error("Error creating fixture: ", error);
        showToast("Could not create the fixture.", 'error');
    }
}

export async function cancelMatch() {
    let fixtureToCancel = null;

    if (state.userRole === 'admin') {
        const teamAFixture = state.allFixtures.find(f => f.status === 'live' && f.team === 'A');
        const teamBFixture = state.allFixtures.find(f => f.status === 'live' && f.team === 'B');

        if (teamAFixture && teamBFixture) {
            const teamToCheck = state.activeMatchView || 'A';
            fixtureToCancel = teamToCheck === 'A' ? teamAFixture : teamBFixture;
        } else if (teamAFixture) {
            fixtureToCancel = teamAFixture;
        } else if (teamBFixture) {
            fixtureToCancel = teamBFixture;
        }
    } else {
        fixtureToCancel = state.fixture.id ? state.fixture : null;
    }

    if (!fixtureToCancel || !fixtureToCancel.id) return;

    try {
        const fixtureRef = doc(state.db, FIXTURES_COLLECTION, fixtureToCancel.id);

        await safeFirebaseCall('cancelMatch', async () => {
            const emptyGames = GAME_TITLES.map((title) => {
                const isDoubles = title.includes("Doubles");
                return {
                    title: title,
                    type: isDoubles ? 'doubles' : 'singles',
                    playerIds: [],
                    legsWon: 0,
                    legsLost: 0,
                    highCheckout: 0,
                    fines: 0,
                    finesList: [],
                    playerScores: []
                };
            });

            return await updateDoc(fixtureRef, {
                status: 'scheduled',
                games: emptyGames,
                activeGameIndex: 0
            });
        });

        showToast("Match cancelled and returned to upcoming fixtures.");
        render();
        switchTab('fixtures');
    } catch (error) {
        if (error.message.includes('Rate limit')) {
            showToast(error.message, 'error');
        } else {
            console.error("Error cancelling match:", error);
            showToast("Could not cancel the match.", 'error');
        }
    }
}

export async function finishMatch(dotdPlayerId) {
    const fixtureRef = doc(state.db, FIXTURES_COLLECTION, state.fixture.id);
    const seasonId = state.fixture.seasonId;

    try {
        state.fixture.games.forEach(game => {
            if (!game.playerNames) {
                game.playerNames = game.playerIds.map(id =>
                    state.players.find(p => p.id === id)?.name || 'Unknown'
                );
            }
        });

        await runTransaction(state.db, async (transaction) => {
            const allPlayerIds = [...new Set(state.fixture.games.flatMap(game => game.playerIds))];
            if (dotdPlayerId && !allPlayerIds.includes(dotdPlayerId)) {
                allPlayerIds.push(dotdPlayerId);
            }

            const playerRefs = allPlayerIds.map(id => doc(state.db, PLAYERS_COLLECTION, id));
            const playerDocs = await Promise.all(playerRefs.map(ref => transaction.get(ref)));

            const matchAuditData = {
                action: 'match_completed',
                fixtureId: state.fixture.id,
                oppositionName: state.fixture.oppositionName,
                seasonId: seasonId,
                seasonName: state.seasons.find(s => s.id === seasonId)?.name || 'Unknown Season',
                completedBy: state.userName || state.userEmail || 'Unknown',
                completedByUserId: state.userId,
                players: allPlayerIds.map(playerId => {
                    const playerDoc = playerDocs.find(doc => doc.id === playerId);
                    const playerData = playerDoc?.exists() ? playerDoc.data() : {};
                    return {
                        playerId: playerId,
                        playerName: playerData.name || 'Unknown'
                    };
                }),
                dotdWinner: dotdPlayerId ? {
                    playerId: dotdPlayerId,
                    playerName: state.players.find(p => p.id === dotdPlayerId)?.name || 'Unknown'
                } : null,
                gameResults: state.fixture.games.map(game => ({
                    title: game.title,
                    type: game.type,
                    playerNames: game.playerIds.map(id =>
                        state.players.find(p => p.id === id)?.name || 'Unknown'
                    ),
                    legsWon: game.legsWon || 0,
                    legsLost: game.legsLost || 0
                })),
                timestamp: serverTimestamp(),
                userAgent: navigator.userAgent
            };

            const auditRef = doc(collection(state.db, 'audit_logs'));
            transaction.set(auditRef, matchAuditData);

            const playerUpdates = {};

            for (let i = 0; i < allPlayerIds.length; i++) {
                const playerId = allPlayerIds[i];
                const playerDoc = playerDocs[i];

                if (!playerDoc.exists()) continue;

                const playerData = playerDoc.data();
                const newStats = JSON.parse(JSON.stringify(playerData.stats || {}));

                if (!newStats[seasonId]) newStats[seasonId] = {};
                if (!newStats[seasonId].singles) newStats[seasonId].singles = {};
                if (!newStats[seasonId].doubles) newStats[seasonId].doubles = {};

                state.fixture.games.forEach(game => {
                    if (!game.playerIds.includes(playerId)) return;

                    const playerIndex = game.playerIds.indexOf(playerId);
                    const pScores = game.playerScores?.[playerIndex] || {};
                    const gameType = game.type;
                    const gameWon = game.legsWon > game.legsLost;

                    const seasonStats = newStats[seasonId][gameType];

                    seasonStats.gamesWon = (seasonStats.gamesWon || 0) + (gameWon ? 1 : 0);
                    seasonStats.gamesLost = (seasonStats.gamesLost || 0) + (!gameWon ? 1 : 0);
                    seasonStats.legsWon = (seasonStats.legsWon || 0) + (game.legsWon || 0);
                    seasonStats.legsLost = (seasonStats.legsLost || 0) + (game.legsLost || 0);
                    seasonStats.scores100 = (seasonStats.scores100 || 0) + (pScores.scores100 || 0);
                    seasonStats.scores140 = (seasonStats.scores140 || 0) + (pScores.scores140 || 0);
                    seasonStats.scores180 = (seasonStats.scores180 || 0) + (pScores.scores180 || 0);

                    if (gameType === 'singles') {
                        const singlesSeasonStats = newStats[seasonId].singles;
                        singlesSeasonStats.outstandingFines = (singlesSeasonStats.outstandingFines || 0) + (game.fines || 0);
                        singlesSeasonStats.totalFines = (singlesSeasonStats.totalFines || 0) + (game.fines || 0);
                        if (game.highCheckout > (singlesSeasonStats.highCheckout || 0)) {
                            singlesSeasonStats.highCheckout = game.highCheckout;
                        }
                    } else if (gameType === 'doubles') {
                        const playerHighCheckout = pScores.highCheckout || 0;
                        if (playerHighCheckout > (seasonStats.highCheckout || 0)) {
                            seasonStats.highCheckout = playerHighCheckout;
                        }

                        const singlesSeasonStats = newStats[seasonId].singles;
                        let playerFines = 0;
                        if (game.finesList && Array.isArray(game.finesList)) {
                            game.finesList.forEach(fine => {
                                if (fine.playerId === playerId) {
                                    playerFines += fine.amount || 0;
                                }
                            });
                        }
                        singlesSeasonStats.outstandingFines = (singlesSeasonStats.outstandingFines || 0) + playerFines;
                        singlesSeasonStats.totalFines = (singlesSeasonStats.totalFines || 0) + playerFines;
                    }
                });

                if (dotdPlayerId === playerId) {
                    const singlesSeasonStats = newStats[seasonId].singles;
                    singlesSeasonStats.outstandingFines = (singlesSeasonStats.outstandingFines || 0) + 250;
                    singlesSeasonStats.totalFines = (singlesSeasonStats.totalFines || 0) + 250;
                }

                playerUpdates[playerId] = { stats: newStats };
            }

            transaction.update(fixtureRef, { status: 'finished' });

            for (let i = 0; i < allPlayerIds.length; i++) {
                const playerId = allPlayerIds[i];
                if (playerUpdates[playerId]) {
                    transaction.update(playerRefs[i], playerUpdates[playerId]);
                }
            }
        });

        showToast("Match finished and all stats saved! Well played.", 'success');
        ui.dotdModal.overlay.classList.add('hidden');
        ui.dotdModal.overlay.classList.remove('flex');
        document.body.classList.remove('modal-open');
        render(); 
        switchTab('match');

    } catch (e) {
        console.error("Transaction failed: ", e);
        showToast("Failed to save match stats. Please try again.", 'error');
    }
}