import { db } from '../firebase-config.js';
import { collection, doc, getDoc, addDoc, updateDoc, onSnapshot, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from '../state.js';
import { ui } from '../ui-elements.js';
import { showToast, safeFirebaseCall, validateInput, PLAYERS_COLLECTION, SEASONS_COLLECTION } from '../utils.js';

export function renderAdminSeasonsList() {
    const seasonsList = document.getElementById('admin-seasons-list');
    if (!seasonsList) return;

    seasonsList.innerHTML = '';
    if (state.seasons.length === 0) {
        seasonsList.innerHTML = `<p class="text-gray-500 dark:text-gray-400">No seasons created yet.</p>`;
    } else {
        state.seasons.forEach(season => {
            const isActive = season.id === state.activeSeasonId;
            const seasonEl = document.createElement('div');
            seasonEl.className = `flex items-center justify-between p-2 rounded-lg ${isActive ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-gray-100 dark:bg-gray-700'}`;
            seasonEl.innerHTML = `
                <span class="font-medium dark:text-white">${season.name}${isActive ? ' (Active)' : ''}</span>
                ${!isActive ? `<button data-season-id="${season.id}" class="admin-set-active-season-btn text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-sm font-semibold">Set Active</button>` : ''}
            `;
            seasonsList.appendChild(seasonEl);
        });
    }
}

export function renderAdminPlayerRoster() {
    const list = document.getElementById('admin-player-roster-list');
    if (!list) return;

    list.innerHTML = '';
    
    const teamFilter = document.getElementById('admin-team-filter')?.value || 'all';
    
    let activePlayers = state.players.filter(p => !p.archived);
    
    if (teamFilter !== 'all') {
        if (teamFilter === 'none') {
            activePlayers = activePlayers.filter(p => !p.team);
        } else {
            activePlayers = activePlayers.filter(p => p.team === teamFilter);
        }
    }
    
    if (activePlayers.length === 0) {
        list.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">No players in roster.</p>';
        return;
    }

    activePlayers.forEach(player => {
        const teamLabel = player.team ? `Team ${player.team}` : 'No Team';
        const playerEl = document.createElement('div');
        playerEl.className = 'flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded-lg';
        playerEl.innerHTML = `
            <div class="flex-1 min-w-0">
                <p class="font-medium dark:text-white truncate">${player.name}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">${player.nickname || 'No nickname'} • ${teamLabel}</p>
            </div>
            <button data-player-id="${player.id}" class="admin-archive-player-btn text-orange-500 hover:text-orange-700 text-sm font-semibold ml-2">Archive</button>
        `;
        list.appendChild(playerEl);
    });

    const tempPlayers = state.players.filter(p => p.isTemporary);
    if (tempPlayers.length > 0) {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-3';
        warningDiv.innerHTML = `
            <div class="flex">
                <svg class="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
                <div>
                    <h4 class="text-sm font-medium text-yellow-800 dark:text-yellow-200">Temporary Players</h4>
                    <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">${tempPlayers.length} player(s) were auto-created during match setup. Review and assign teams via "Manage Player Profiles".</p>
                </div>
            </div>
        `;
        list.insertBefore(warningDiv, list.firstChild);
    }
}

export function renderArchivedPlayers() {
    const list = document.getElementById('admin-archived-player-list');
    if (!list) return;

    list.innerHTML = '';
    const archivedPlayers = state.players.filter(p => p.archived);

    if (archivedPlayers.length === 0) {
        list.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">No archived players.</p>';
        return;
    }

    archivedPlayers.forEach(player => {
        const teamLabel = player.team ? `Team ${player.team}` : 'No Team';
        const playerEl = document.createElement('div');
        playerEl.className = 'flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded-lg opacity-75';
        playerEl.innerHTML = `
            <div class="flex-1 min-w-0">
                <p class="font-medium dark:text-white truncate">${player.name}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">${player.nickname || 'No nickname'} • ${teamLabel}</p>
            </div>
            <button data-player-id="${player.id}" class="admin-unarchive-player-btn text-emerald-500 hover:text-emerald-700 text-sm font-semibold ml-2">Restore</button>
        `;
        list.appendChild(playerEl);
    });
}

export async function addPlayer() {
    const nameInput = document.getElementById('admin-new-player-name');
    const nicknameInput = document.getElementById('admin-new-player-nickname');
    const teamSelect = document.getElementById('admin-new-player-team');

    if (!nameInput) return; 

    try {
        const name = validateInput(nameInput.value, 50);
        const nickname = validateInput(nicknameInput.value, 50);
        const team = teamSelect.value || null;

        if (!name) {
            showToast("Player name cannot be empty.", 'error');
            return;
        }

        await safeFirebaseCall('addPlayer', async () => {
            return await addDoc(collection(state.db, PLAYERS_COLLECTION), {
                name: name,
                nickname: nickname,
                team: team,
                stats: {}
            });
        });

        showToast(`${name} added to the roster.`);
        nameInput.value = '';
        nicknameInput.value = '';
        teamSelect.value = '';
    } catch (error) {
        if (error.message.includes('Invalid characters') || error.message.includes('Input too long')) {
            showToast(error.message, 'error');
        } else if (error.message.includes('Rate limit')) {
            showToast(error.message, 'error');
        } else {
            console.error("Error adding player: ", error);
            showToast("Could not add player.", 'error');
        }
    }
}

export async function archivePlayer(playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    try {
        await safeFirebaseCall('archivePlayer', async () => {
            const playerRef = doc(state.db, PLAYERS_COLLECTION, playerId);
            return await updateDoc(playerRef, {
                archived: true,
                archivedAt: serverTimestamp()
            });
        });
        showToast(`${player.name} has been archived.`);
    } catch (error) {
        if (error.message.includes('Rate limit')) {
            showToast(error.message, 'error');
        } else {
            console.error("Error archiving player:", error);
            showToast("Could not archive player.", 'error');
        }
    }
}

export async function unarchivePlayer(playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    try {
        await safeFirebaseCall('unarchivePlayer', async () => {
            const playerRef = doc(state.db, PLAYERS_COLLECTION, playerId);
            return await updateDoc(playerRef, {
                archived: false,
                unarchivedAt: serverTimestamp()
            });
        });
        showToast(`${player.name} has been restored to the roster.`);
    } catch (error) {
        if (error.message.includes('Rate limit')) {
            showToast(error.message, 'error');
        } else {
            console.error("Error unarchiving player:", error);
            showToast("Could not unarchive player.", 'error');
        }
    }
}

export async function loadUsers() {
    if (!state.db) return;
    const usersCollection = collection(state.db, 'users');
    onSnapshot(query(usersCollection), (snapshot) => {
        const usersList = document.getElementById('users-list');
        if (!usersList) return;

        usersList.innerHTML = '';

        let unassignedCount = 0;
        const teamFilter = document.getElementById('admin-team-filter')?.value || 'all';

        snapshot.docs.forEach(docSnap => {
            const userData = docSnap.data();

            if (teamFilter !== 'all') {
                if (teamFilter === 'none' && userData.team) return;
                if (teamFilter === 'A' && userData.team !== 'A') return;
                if (teamFilter === 'B' && userData.team !== 'B') return;
            }
            const userItem = document.createElement('div');
            userItem.className = 'flex flex-col sm:flex-row sm:items-center justify-between bg-gray-100 dark:bg-gray-600 p-3 rounded-lg space-y-2 sm:space-y-0';
            const hasTeam = userData.team === 'A' || userData.team === 'B';
            userItem.innerHTML = `
                <div class="min-w-0 flex-1">
                    <p class="font-medium dark:text-white truncate">${userData.name || userData.email} ${!hasTeam ? '<span class="text-yellow-600 dark:text-yellow-400">⚠</span>' : ''}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${userData.email}</p>
                    ${!hasTeam ? '<p class="text-xs text-yellow-600 dark:text-yellow-400 font-medium">No team assigned</p>' : ''}
                </div>
                <div class="flex flex-col sm:flex-row items-end sm:items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
                    <select data-user-id="${docSnap.id}" class="user-team-select w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700 text-xs sm:text-sm">
                        <option value="">No Team</option>
                        <option value="A" ${userData.team === 'A' ? 'selected' : ''}>A Team</option>
                        <option value="B" ${userData.team === 'B' ? 'selected' : ''}>B Team</option>
                    </select>
                    <select data-user-id="${docSnap.id}" class="user-role-select w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700 text-xs sm:text-sm">
                        <option value="viewer" ${userData.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                        <option value="scorer" ${userData.role === 'scorer' ? 'selected' : ''}>Scorer</option>
                        <option value="member" ${userData.role === 'member' ? 'selected' : ''}>Member</option>
                        <option value="admin" ${userData.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                    <select data-user-id="${docSnap.id}" class="user-player-select w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700 text-xs sm:text-sm">
                        <option value="">No Player</option>
                        ${state.players.map(p => `<option value="${p.id}" ${userData.playerId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
            `;
            usersList.appendChild(userItem);

            if (!hasTeam) {
                unassignedCount++;
            }
        });

        const warning = document.getElementById('unassigned-users-warning');
        const countSpan = document.getElementById('unassigned-count');
        if (warning && countSpan) {
            if (unassignedCount > 0) {
                warning.classList.remove('hidden');
                countSpan.textContent = unassignedCount;
            } else {
                warning.classList.add('hidden');
            }
        }
    }, (error) => {
        console.error("Error loading users:", error);
    });
}

export async function updateUserTeam(userId, newTeam) {
    try {
        const targetUserDoc = await getDoc(doc(state.db, 'users', userId));
        const targetUserData = targetUserDoc.exists() ? targetUserDoc.data() : {};

        await safeFirebaseCall('auditLog', async () => {
            return await addDoc(collection(state.db, 'audit_logs'), {
                action: 'team_change',
                targetUserId: userId,
                targetUserName: targetUserData.name || 'Unknown',
                targetUserEmail: targetUserData.email || 'Unknown',
                oldTeam: targetUserData.team || null,
                newTeam: newTeam,
                adminUserId: state.userId,
                adminUserName: state.userName || 'Unknown',
                adminEmail: state.userEmail,
                timestamp: serverTimestamp(),
                userAgent: navigator.userAgent
            });
        });

        await safeFirebaseCall('updateUserTeam', async () => {
            return await updateDoc(doc(state.db, 'users', userId), {
                team: newTeam,
                updatedAt: serverTimestamp()
            });
        });

        if (targetUserData.playerId) {
            await safeFirebaseCall('updatePlayerTeam', async () => {
                return await updateDoc(doc(state.db, PLAYERS_COLLECTION, targetUserData.playerId), {
                    team: newTeam
                });
            });
        }

        if (userId === state.userId) {
            state.userTeam = newTeam;
            state.activeMatchView = newTeam || 'A';
            localStorage.setItem('userTeam', newTeam || '');
        }

        showToast('User team updated successfully.');
    } catch (error) {
        if (error.message.includes('Rate limit')) {
            showToast(error.message, 'error');
        } else {
            console.error('Error updating user team:', error);
            showToast('Failed to update user team.', 'error');
        }
    }
}

export async function updateUserRole(userId, newRole) {
    try {
        const targetUserDoc = await getDoc(doc(state.db, 'users', userId));
        const targetUserData = targetUserDoc.exists() ? targetUserDoc.data() : {};

        await safeFirebaseCall('auditLog', async () => {
            return await addDoc(collection(state.db, 'audit_logs'), {
                action: 'role_change',
                targetUserId: userId,
                targetUserName: targetUserData.name || 'Unknown',
                targetUserEmail: targetUserData.email || 'Unknown',
                oldRole: targetUserData.role || 'unknown',
                newRole: newRole,
                adminUserId: state.userId,
                adminUserName: state.userName || 'Unknown',
                adminEmail: state.userEmail,
                timestamp: serverTimestamp(),
                userAgent: navigator.userAgent
            });
        });

        await safeFirebaseCall('updateUserRole', async () => {
            return await updateDoc(doc(state.db, 'users', userId), {
                role: newRole,
                updatedAt: serverTimestamp()
            });
        });

        if (userId === state.userId) {
            state.userRole = newRole;
            localStorage.setItem('userRole', newRole);
        }

        showToast('User role updated successfully.');
    } catch (error) {
        if (error.message.includes('Rate limit')) {
            showToast(error.message, 'error');
        } else {
            console.error('Error updating user role:', error);
            showToast('Failed to update user role.', 'error');
        }
    }
}

export async function updateUserPlayer(userId, newPlayerId) {
    try {
        const targetUserDoc = await getDoc(doc(state.db, 'users', userId));
        const targetUserData = targetUserDoc.exists() ? targetUserDoc.data() : {};

        const oldPlayer = state.players.find(p => p.id === targetUserData.playerId);
        const newPlayer = newPlayerId ? state.players.find(p => p.id === newPlayerId) : null;

        await safeFirebaseCall('auditLog', async () => {
            return await addDoc(collection(state.db, 'audit_logs'), {
                action: 'player_link_change',
                targetUserId: userId,
                targetUserName: targetUserData.name || 'Unknown',
                targetUserEmail: targetUserData.email || 'Unknown',
                oldPlayerId: targetUserData.playerId || null,
                oldPlayerName: oldPlayer?.name || null,
                newPlayerId: newPlayerId,
                newPlayerName: newPlayer?.name || null,
                adminUserId: state.userId,
                adminUserName: state.userName || 'Unknown',
                adminEmail: state.userEmail,
                timestamp: serverTimestamp(),
                userAgent: navigator.userAgent
            });
        });

        await safeFirebaseCall('updateUserPlayer', async () => {
            return await updateDoc(doc(state.db, 'users', userId), {
                playerId: newPlayerId,
                updatedAt: serverTimestamp()
            });
        });

        if (newPlayerId && targetUserData.team) {
            await safeFirebaseCall('updatePlayerTeam', async () => {
                return await updateDoc(doc(state.db, PLAYERS_COLLECTION, newPlayerId), {
                    team: targetUserData.team
                });
            });
        }

        if (userId === state.userId) {
            state.userPlayerId = newPlayerId;
        }

        showToast('User player link updated successfully.');
    } catch (error) {
        if (error.message.includes('Rate limit')) {
            showToast(error.message, 'error');
        } else {
            console.error('Error updating user player link:', error);
            showToast('Failed to update user player link.', 'error');
        }
    }
}