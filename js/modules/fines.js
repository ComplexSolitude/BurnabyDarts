import { db } from "../firebase-config.js";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from "../state.js";
import { ui } from "../ui-elements.js";
import { showToast, safeFirebaseCall, FIXTURES_COLLECTION } from "../utils.js";
import { getPlayerStats } from "./stats.js"; // We will build this in the next step!
import { render, updateGameData } from "../app.js"; // We will build this at the very end

export function renderFines() {
  ui.finesList.innerHTML = "";
  let totalOutstandingFines = 0;
  const teamPlayers = state.players.filter((p) => p.team === state.userTeam);
  const playersWithFines = teamPlayers
    .map((p) => {
      const allTimeStats = getPlayerStats(p, "all-time", "singles");
      return { ...p, outstandingFines: allTimeStats.outstandingFines };
    })
    .filter((p) => p.outstandingFines > 0);

  playersWithFines.forEach((player) => {
    totalOutstandingFines += player.outstandingFines;
    const fineEl = document.createElement("div");
    fineEl.className = "p-4 flex items-center justify-between";
    fineEl.innerHTML = `
            <div>
                <p class="font-semibold dark:text-white">${player.name}</p>
                <p class="text-lg font-bold text-red-600 dark:text-red-400">£${(player.outstandingFines / 100).toFixed(2)}</p>
            </div>
            ${state.userRole === "admin" ? `<button data-player-id="${player.id}" class="pay-fines-btn bg-emerald-600 text-white py-2 px-4 rounded-xl hover:bg-emerald-700">Mark as Paid</button>` : ""}
        `;
    ui.finesList.appendChild(fineEl);
  });

  if (totalOutstandingFines === 0) {
    ui.finesList.innerHTML =
      '<p class="p-4 text-gray-500 dark:text-gray-400">No outstanding fines. Good lads.</p>';
    ui.payFineContainer.classList.add("hidden");
  } else {
    ui.payFineContainer.classList.remove("hidden");
  }
}

export function renderCurrentGameFines(game) {
  if (!ui.finesListCurrentGame) return;

  ui.finesListCurrentGame.innerHTML = "";

  if (!game.finesList || game.finesList.length === 0) {
    ui.finesListCurrentGame.innerHTML =
      '<p class="text-center text-sm text-gray-500 dark:text-gray-400">No fines this game</p>';
    return;
  }

  const fineGroups = {
    "Score of 26": [],
    "Missed Board": [],
    "Low Scores": [],
  };

  game.finesList.forEach((fine) => {
    if (fine.reason === "Score of 26") {
      fineGroups["Score of 26"].push(fine);
    } else if (fine.reason === "Missed Board") {
      fineGroups["Missed Board"].push(fine);
    } else if (fine.reason.startsWith("Score of ")) {
      fineGroups["Low Scores"].push(fine);
    }
  });

  Object.entries(fineGroups).forEach(([groupName, fines]) => {
    if (fines.length === 0) return;

    const headerEl = document.createElement("div");
    headerEl.className =
      "text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1 mt-2 first:mt-0";

    const groupTotal = fines.reduce((sum, fine) => sum + fine.amount, 0);
    const count = fines.length;

    headerEl.innerHTML = `${groupName} (${count}) - £${(groupTotal / 100).toFixed(2)}`;
    ui.finesListCurrentGame.appendChild(headerEl);

    fines.forEach((fine) => {
      const fineEl = document.createElement("div");
      fineEl.className =
        "flex items-center justify-between bg-red-50 dark:bg-red-900/20 p-2 rounded-lg text-sm mb-1";

      let displayText = fine.reason;
      if (groupName === "Low Scores") {
        displayText = fine.reason;
      } else {
        displayText = `${groupName}`;
      }

      let playerName = "";
      if (fine.playerId) {
        const player = state.players.find((p) => p.id === fine.playerId);
        if (player) {
          playerName = ` - ${player.name}`;
        }
      }

      fineEl.innerHTML = `
                <span class="text-red-700 dark:text-red-300">${displayText}${playerName}</span>
                <div class="flex items-center gap-2">
                    <span class="font-bold text-red-600 dark:text-red-400">£${(fine.amount / 100).toFixed(2)}</span>
                    ${state.userRole !== "viewer" ? `<button data-fine-id="${fine.id}" class="remove-fine-btn text-red-500 hover:text-red-700 text-xs bg-white dark:bg-gray-700 px-2 py-1 rounded border">✕</button>` : ""}
                </div>
            `;
      ui.finesListCurrentGame.appendChild(fineEl);
    });
  });
}

export async function addFine(amount, reason, playerId = null) {
  const game = state.fixture.games[state.currentGameIndex];
  if (!game) return;

  const fineId = `${Date.now()}-${state.userId || "anon"}-${Math.random().toString(36).substr(2, 9)}`;
  const newFine = {
    id: fineId,
    amount: amount,
    reason: reason,
    playerId: playerId,
    timestamp: new Date().toISOString(),
    addedBy: state.userId || "anonymous",
  };

  try {
    const fixtureRef = doc(db, FIXTURES_COLLECTION, state.fixture.id);

    await safeFirebaseCall("addFine", async () => {
      return await runTransaction(db, async (transaction) => {
        const fixtureDoc = await transaction.get(fixtureRef);
        if (!fixtureDoc.exists())
          throw new Error("Fixture document does not exist!");

        const serverData = fixtureDoc.data();
        const currentGame = serverData.games[state.currentGameIndex];

        const existingFines = currentGame.finesList || [];
        const duplicateFine = existingFines.find(
          (f) =>
            f.reason === reason &&
            f.amount === amount &&
            Math.abs(
              new Date(f.timestamp).getTime() -
                new Date(newFine.timestamp).getTime(),
            ) < 5000,
        );

        if (duplicateFine) throw new Error("DUPLICATE_FINE");

        const updatedFinesList = [...existingFines, newFine];
        const updatedFinesTotal = (currentGame.fines || 0) + amount;

        const updatedGames = [...serverData.games];
        updatedGames[state.currentGameIndex] = {
          ...currentGame,
          finesList: updatedFinesList,
          fines: updatedFinesTotal,
        };

        return transaction.update(fixtureRef, { games: updatedGames });
      });
    });

    showToast(`Fine added: ${reason} (+£${(amount / 100).toFixed(2)})`);
  } catch (error) {
    if (error.message === "DUPLICATE_FINE") {
      showToast(`Fine already added by another scorer!`, "warning");
    } else if (error.message.includes("Rate limit")) {
      showToast(error.message, "error");
    } else {
      console.error("Error adding fine:", error);
      showToast("Could not add fine, please try again.", "error");
    }
  }
}

export async function markFinesAsPaid(playerId) {
  const playerRef = doc(db, "players", playerId);
  try {
    const player = state.players.find((p) => p.id === playerId);
    if (!player || !player.stats) {
      showToast("Player has no stats to clear.", "error");
      return;
    }

    const allTimeStats = getPlayerStats(player, "all-time", "singles");
    const totalOutstandingFines = allTimeStats.outstandingFines;

    await safeFirebaseCall("auditLog", async () => {
      return await addDoc(collection(db, "audit_logs"), {
        action: "fines_cleared",
        targetPlayerId: playerId,
        targetPlayerName: player.name,
        finesCleared: totalOutstandingFines,
        clearedBy: state.userName || state.userEmail || "Unknown",
        clearedByUserId: state.userId,
        clearedByEmail: state.userEmail,
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent,
      });
    });

    const updates = {};
    for (const seasonId in player.stats) {
      updates[`stats.${seasonId}.singles.outstandingFines`] = 0;
    }
    await updateDoc(playerRef, updates);
  } catch (error) {
    console.error("Error clearing fines: ", error);
    showToast("Could not clear fines.", "error");
  }
}

export function openLowScoreModal() {
  ui.lowScoreModal.overlay.classList.remove("hidden");
  ui.lowScoreModal.overlay.classList.add("flex");
  ui.lowScoreModal.input.focus();
  document.body.classList.add("modal-open");
}

export function closeLowScoreModal() {
  ui.lowScoreModal.overlay.classList.add("hidden");
  ui.lowScoreModal.overlay.classList.remove("flex");
  ui.lowScoreModal.input.value = "";
  document.body.classList.remove("modal-open");
}

export function submitLowScoreFine() {
  const score = parseInt(ui.lowScoreModal.input.value);
  if (score >= 1 && score <= 9) {
    const game = state.fixture.games[state.currentGameIndex];
    const isDoubles = game && game.playerIds.length > 1;

    if (isDoubles) {
      closeLowScoreModal();
      openFinePlayerModal((10 - score) * 10, `Score of ${score}`);
    } else {
      addFine((10 - score) * 10, `Score of ${score}`, game.playerIds[0]);
      closeLowScoreModal();
    }
  } else {
    showToast("Please enter a score between 1 and 9.", "warning");
  }
}

export function openFinePlayerModal(amount, reason) {
  const game = state.fixture.games[state.currentGameIndex];
  if (!game) return;

  state.pendingFine.amount = amount;
  state.pendingFine.reason = reason;

  ui.finePlayerModal.list.innerHTML = "";
  game.playerIds.forEach((playerId) => {
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return;

    const btn = document.createElement("button");
    btn.className =
      "w-full bg-emerald-600 text-white py-3 px-4 rounded-xl hover:bg-emerald-700 transition-colors font-semibold";
    btn.textContent = player.name;
    btn.dataset.playerId = playerId;
    btn.addEventListener("click", () => {
      addFine(state.pendingFine.amount, state.pendingFine.reason, playerId);
      closeFinePlayerModal();
    });
    ui.finePlayerModal.list.appendChild(btn);
  });

  ui.finePlayerModal.overlay.classList.remove("hidden");
  ui.finePlayerModal.overlay.classList.add("flex");
  document.body.classList.add("modal-open");
}

export function closeFinePlayerModal() {
  ui.finePlayerModal.overlay.classList.add("hidden");
  ui.finePlayerModal.overlay.classList.remove("flex");
  state.pendingFine.amount = null;
  state.pendingFine.reason = null;
  document.body.classList.remove("modal-open");
}

export function removeFine(fineId) {
  const game = state.fixture.games[state.currentGameIndex];
  if (!game || !game.finesList) return;

  const fineIndex = game.finesList.findIndex((f) => f.id === fineId);
  if (fineIndex === -1) return;

  const removedFine = game.finesList[fineIndex];
  game.finesList.splice(fineIndex, 1);

  game.fines = Math.max(0, (game.fines || 0) - removedFine.amount);

  showToast(
    `Fine removed: ${removedFine.reason} (-£${(removedFine.amount / 100).toFixed(2)})`,
  );
  render();
  updateGameData();
}
