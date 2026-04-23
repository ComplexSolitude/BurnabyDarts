import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, onSnapshot, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { state, PLAYERS_COLLECTION } from '../state.js';
import { ui } from '../ui-elements.js';
import { showToast, safeFirebaseCall, validateInput } from '../utils.js';
import { render } from '../app.js';

export async function loadUsers() {
    if (!state.db) return;
    const usersCollection = collection(state.db, 'users');
    onSnapshot(usersCollection, (snapshot) => {
        const usersList = document.getElementById('users-list');
        if (!usersList) return;

        usersList.innerHTML = '';

        let unassignedCount = 0;
        const teamFilter = document.getElementById('admin-team-filter')?.value || 'all';

        snapshot.docs.forEach(doc => {
            const userData = doc.data();

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
                    <select data-user-id="${doc.id}" class="user-team-select w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700 text-xs sm:text-sm">
                        <option value="">No Team</option>
                        <option value="A" ${userData.team === 'A' ? 'selected' : ''}>A Team</option>
                        <option value="B" ${userData.team === 'B' ? 'selected' : ''}>B Team</option>
                    </select>
                    <select data-user-id="${doc.id}" class="user-role-select w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700 text-xs sm:text-sm">
                        <option value="viewer" ${userData.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                        <option value="scorer" ${userData.role === 'scorer' ? 'selected' : ''}>Scorer</option>
                        <option value="member" ${userData.role === 'member' ? 'selected' : ''}>Member</option>
                        <option value="admin" ${userData.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                    <select data-user-id="${doc.id}" class="user-player-select w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700 text-xs sm:text-sm">
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

        document.querySelectorAll('.user-team-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const userId = e.target.dataset.userId;
                const newTeam = e.target.value || null;
                await updateUserTeam(userId, newTeam);
            });
        });

        document.querySelectorAll('.user-role-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const userId = e.target.dataset.userId;
                const newRole = e.target.value;
                await updateUserRole(userId, newRole);
            });
        });

        document.querySelectorAll('.user-player-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const userId = e.target.dataset.userId;
                const newPlayerId = e.target.value || null;
                await updateUserPlayer(userId, newPlayerId);
            });
        });
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
            render();
        }

        showToast('User team updated successfully.');
    } catch (error) {
        console.error('Error updating user team:', error);
        showToast('Failed to update user team.', 'error');
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
                oldRole: targetUserData.role || 'unknown',
                newRole: newRole,
                adminUserId: state.userId,
                adminUserName: state.userName || 'Unknown',
                timestamp: serverTimestamp()
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
            render();
        }

        showToast('User role updated successfully.');
    } catch (error) {
        console.error('Error updating user role:', error);
        showToast('Failed to update user role.', 'error');
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
                oldPlayerId: targetUserData.playerId || null,
                newPlayerId: newPlayerId,
                adminUserId: state.userId,
                adminUserName: state.userName || 'Unknown',
                timestamp: serverTimestamp()
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
            render();
        }

        showToast('User player link updated successfully.');
    } catch (error) {
        console.error('Error updating user player link:', error);
        showToast('Failed to update user player link.', 'error');
    }
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
        console.error("Error adding player: ", error);
        showToast("Could not add player.", 'error');
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
        console.error("Error archiving player:", error);
        showToast("Could not archive player.", 'error');
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
        console.error("Error unarchiving player:", error);
        showToast("Could not unarchive player.", 'error');
    }
}