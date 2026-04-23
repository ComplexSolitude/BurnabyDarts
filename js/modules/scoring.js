import { doc, updateDoc, runTransaction, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { state, FIXTURES_COLLECTION, PLAYERS_COLLECTION } from '../state.js';
import { ui } from '../ui-elements.js';
import { showToast, safeFirebaseCall } from '../utils.js';
import { render, switchTab } from '../app.js';

export async function updateGameData() {
    if (!state.fixture.id) return;
    const fixtureRef = doc(db, FIXTURES_COLLECTION, state.fixture.id);
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

export async function finishMatch(dotdPlayerId) {
    const fixtureRef = doc(db, FIXTURES_COLLECTION, state.fixture.id);
    const seasonId = state.fixture.seasonId;

    try {
        state.fixture.games.forEach(game => {
            if (!game.playerNames) {
                game.playerNames = game.playerIds.map(id =>
                    state.players.find(p => p.id === id)?.name || 'Unknown'
                );
            }
        });

        await runTransaction(db, async (transaction) => {
            const allPlayerIds = [...new Set(state.fixture.games.flatMap(game => game.playerIds))];
            if (dotdPlayerId && !allPlayerIds.includes(dotdPlayerId)) {
                allPlayerIds.push(dotdPlayerId);
            }

            const playerRefs = allPlayerIds.map(id => doc(db, PLAYERS_COLLECTION, id));
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

            const auditRef = doc(collection(db, 'audit_logs'));
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