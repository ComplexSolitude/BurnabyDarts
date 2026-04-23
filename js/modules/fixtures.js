import { doc, updateDoc, addDoc, collection, serverTimestamp, Timestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { state, FIXTURES_COLLECTION, PLAYERS_COLLECTION, GAME_TITLES } from '../state.js';
import { ui } from '../ui-elements.js';
import { showToast, safeFirebaseCall, validateInput } from '../utils.js';
import { render, switchTab, openConfirmModal, closeConfirmModal } from '../app.js';

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
                        ${fixture.venue ? (fixture.address ? `<a href="https://www.google.com/maps/place/${encodeURIComponent(fixture.address)}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700 underline cursor-pointer" title="View location on Google Maps">${fixture.venue}</a>` : fixture.venue) : 'TBD'}
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

    if (!opposition || !date) {
        showToast("Opposition name and Match date cannot be empty.", 'warning');
        return;
    }

    try {
        const scheduledDate = Timestamp.fromDate(new Date(date));
        const updates = { oppositionName: opposition, scheduledDate, location, venue: venue || null, address: address || null };

        if (team && state.userRole === 'admin') updates.team = team;

        await safeFirebaseCall('updateFixture', async () => {
            return await updateDoc(doc(state.db, FIXTURES_COLLECTION, fixtureId), updates);
        });

        showToast("Fixture updated successfully!");
        closeFixtureModal();
    } catch (error) {
        console.error("Error updating fixture:", error);
        showToast("Could not update fixture.", 'error');
    }
}

export function deleteFixture(fixtureId) {
    const fixture = state.previousFixtures.find(f => f.id === fixtureId);
    if (!fixture) return;
    openConfirmModal('Delete Match?', `Are you sure you want to delete the match against ${fixture.oppositionName}? This action cannot be undone.`, 'deleteFixture', fixtureId);
}

export function deleteUpcomingFixture(fixtureId) {
    const fixture = state.upcomingFixtures.find(f => f.id === fixtureId);
    if (!fixture) return;
    openConfirmModal('Delete Fixture?', `Are you sure you want to delete the fixture against ${fixture.oppositionName}? This action cannot be undone.`, 'deleteUpcomingFixture', fixtureId);
}

export function deletePreviousFixture(fixtureId) {
    const fixture = state.previousFixtures.find(f => f.id === fixtureId);
    if (!fixture) return;
    openConfirmModal('Delete Match?', `Are you sure you want to delete the match against ${fixture.oppositionName}? This action cannot be undone.`, 'deletePreviousFixture', fixtureId);
}

export async function addScheduledFixture() {
    if (state.userRole === 'viewer' || state.userRole === 'scorer') {
        showToast("You don't have permission to add fixtures.", 'error');
        return;
    }
    if (!state.isLoggedIn || !state.activeSeasonId) {
        showToast("You must be logged in and have an active season to add a fixture.", 'error');
        return;
    }
    showAddFixtureModal();
}

export async function startMatchFromScheduled(fixtureId) {
    if (state.userRole === 'viewer' || state.userRole === 'scorer') {
        showToast("You don't have permission to start matches.", 'error');
        return;
    }

    const scheduledFixture = state.upcomingFixtures.find(f => f.id === fixtureId);
    if (!scheduledFixture) return;

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
            return await updateDoc(doc(state.db, FIXTURES_COLLECTION, fixtureId), {
                status: 'live',
                games: games,
                activeGameIndex: 0,
                createdAt: serverTimestamp()
            });
        });

        ui.oppositionNameInput.value = scheduledFixture.oppositionName;
        if (scheduledFixture.scheduledDate) {
            ui.matchDateInput.value = scheduledFixture.scheduledDate.toDate().toISOString().split('T')[0];
        }

        showToast("Match started! Please set up your team.", 'success');
        render();
        switchTab('setup');
    } catch (error) {
        console.error("Error starting match:", error);
        showToast("Could not start the match.", 'error');
    }
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
                    <input type="text" id="fixture-address" placeholder="e.g., 123 High Street, Burnaby Village" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
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
            if (venueInput.value === 'The Burnaby Arms') venueInput.value = '';
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

    if (!oppositionName || !fixtureDate) {
        showToast("Opposition name and Date are required.", 'warning');
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
                playerIds: [], legsWon: 0, legsLost: 0, highCheckout: 0, fines: 0, finesList: [], playerScores: []
            };
        });

        await safeFirebaseCall('addScheduledFixture', async () => {
            return await addDoc(collection(state.db, FIXTURES_COLLECTION), {
                seasonId: state.activeSeasonId,
                team: fixtureTeam,
                oppositionName, scheduledDate, venue: venue || null, location, address: address || null,
                games, status: 'scheduled', createdAt: serverTimestamp()
            });
        });

        showToast(`Fixture against ${oppositionName} added!`);
        closeAddFixtureModal();
    } catch (error) {
        console.error("Error adding fixture:", error);
        showToast("Could not add fixture.", 'error');
    }
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
                name: trimmedName, nickname: '', team: state.userTeam, stats: {}, isTemporary: true
            });
        });

        showToast(`${trimmedName} added to roster.`);
        return docRef.id;
    } catch (error) {
        console.error("Error creating player:", error);
        showToast("Could not create player.", 'error');
        return null;
    }
}

export async function createFixture() {
    if (state.userRole === 'viewer' || state.userRole === 'scorer') {
        showToast("You don't have permission to create matches.", 'error');
        return;
    }
    if (!state.isLoggedIn || !state.activeSeasonId) {
        showToast("You must be logged in and have an active season.", 'warning');
        return;
    }
    
    const oppositionName = ui.oppositionNameInput.value.trim();
    if(!oppositionName) {
        showToast("Please enter an opposition name.", 'warning');
        return;
    }

    const dateValue = ui.matchDateInput.value;
    let createdAt = dateValue ? Timestamp.fromDate(new Date(parseInt(dateValue.split('-')[0], 10), parseInt(dateValue.split('-')[1], 10) - 1, parseInt(dateValue.split('-')[2], 10))) : serverTimestamp();

    const games = [];
    for (let i = 0; i < GAME_TITLES.length; i++) {
        const title = GAME_TITLES[i];
        const isDoubles = title.includes("Doubles");
        const p1Value = document.getElementById(`game-${i}-p1-input`).value.trim();
        const p1Id = await getOrCreatePlayer(p1Value);
        
        if (!p1Id && p1Value) {
            showToast(`Could not add player for ${title}.`, 'error');
            return;
        }

        const playerIds = p1Id ? [p1Id] : [];

        if (isDoubles) {
            const p2Value = document.getElementById(`game-${i}-p2-input`).value.trim();
            const p2Id = await getOrCreatePlayer(p2Value);

            if (p1Id && p2Id && p1Id === p2Id) {
                showToast(`A player cannot play with themselves in ${title}.`, 'error');
                return;
            }
            if (p2Id) playerIds.push(p2Id);
        }

        games.push({
            title: title,
            type: isDoubles ? 'doubles' : 'singles',
            playerIds: playerIds,
            legsWon: 0, legsLost: 0, highCheckout: 0, fines: 0, finesList: [],
            playerScores: playerIds.map(() => ({ scores100: 0, scores140: 0, scores180: 0, sillyThings: 0 }))
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
            fixtureToCancel = (state.activeMatchView || 'A') === 'A' ? teamAFixture : teamBFixture;
        } else {
            fixtureToCancel = teamAFixture || teamBFixture;
        }
    } else {
        fixtureToCancel = state.fixture.id ? state.fixture : null;
    }

    if (!fixtureToCancel || !fixtureToCancel.id) return;

    try {
        await safeFirebaseCall('cancelMatch', async () => {
            const emptyGames = GAME_TITLES.map((title) => {
                const isDoubles = title.includes("Doubles");
                return { title, type: isDoubles ? 'doubles' : 'singles', playerIds: [], legsWon: 0, legsLost: 0, highCheckout: 0, fines: 0, finesList: [], playerScores: [] };
            });

            return await updateDoc(doc(state.db, FIXTURES_COLLECTION, fixtureToCancel.id), {
                status: 'scheduled',
                games: emptyGames,
                activeGameIndex: 0
            });
        });

        showToast("Match cancelled and returned to upcoming fixtures.");
        closeConfirmModal();
        render();
        switchTab('fixtures');
    } catch (error) {
        console.error("Error cancelling match:", error);
        showToast("Could not cancel the match.", 'error');
    }
}

export async function updateTeamSelections() {
    let fixtureToUpdate = null;

    if (state.userRole === 'admin') {
        const teamAFixture = state.allFixtures.find(f => f.status === 'live' && f.team === 'A');
        const teamBFixture = state.allFixtures.find(f => f.status === 'live' && f.team === 'B');

        if (teamAFixture && teamBFixture) {
            fixtureToUpdate = (state.activeMatchView || 'A') === 'A' ? teamAFixture : teamBFixture;
        } else {
            fixtureToUpdate = teamAFixture || teamBFixture;
        }
    } else {
        fixtureToUpdate = state.fixture.id ? state.fixture : null;
    }

    if (!fixtureToUpdate || !fixtureToUpdate.id) return;

    const games = [];
    for (let i = 0; i < GAME_TITLES.length; i++) {
        const title = GAME_TITLES[i];
        const isDoubles = title.includes("Doubles");
        const p1Value = document.getElementById(`game-${i}-p1-input`).value.trim();
        const p1Id = await getOrCreatePlayer(p1Value);
        
        if (!p1Id && p1Value) {
            showToast(`Could not add player for ${title}.`, 'error');
            return;
        }

        const playerIds = p1Id ? [p1Id] : [];

        if (isDoubles) {
            const p2Value = document.getElementById(`game-${i}-p2-input`).value.trim();
            const p2Id = await getOrCreatePlayer(p2Value);

            if (p1Id && p2Id && p1Id === p2Id) {
                showToast(`A player cannot play with themselves in ${title}.`, 'error');
                return;
            }
            if (p2Id) playerIds.push(p2Id);
        }

        const existingGame = fixtureToUpdate.games[i];
        const updatedGame = { ...existingGame, playerIds: playerIds, type: isDoubles ? 'doubles' : 'singles' };

        if (JSON.stringify(existingGame.playerIds) !== JSON.stringify(playerIds)) {
            updatedGame.playerScores = playerIds.map(() => ({ scores100: 0, scores140: 0, scores180: 0, sillyThings: 0 }));
        }

        games.push(updatedGame);
    }

    try {
        await updateDoc(doc(state.db, FIXTURES_COLLECTION, fixtureToUpdate.id), { games: games });
        showToast("Team selections updated successfully!");
        switchTab('live');
    } catch (error) {
        console.error("Error updating teams:", error);
        showToast("Could not update team selections.", 'error');
    }
}