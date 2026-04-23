// --- CONSTANTS ---
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
export const GAME_TITLES = ["Singles 1", "Singles 2", "Singles 3", "Singles 4", "Singles 5", "Doubles 1", "Doubles 2"];
export const PLAYERS_COLLECTION = 'players';
export const FIXTURES_COLLECTION = 'fixtures';
export const SEASONS_COLLECTION = 'seasons';

// --- APPLICATION STATE ---
export const state = {
    db: null,
    auth: null,
    userId: null,
    unsubscribeFunctions: null,
    userEmail: null,
    userName: null,
    userRole: null, // null, 'viewer', 'member', 'admin'
    userPlayerId: null, // Link to player profile
    userTeam: null,
    activeMatchView: null,
    isLoggedIn: false,
    signingIn: false,
    activeTab: 'match',
    players: [],
    seasons: [],
    activeSeasonId: null,
    selectedStatsSeasonId: 'all-time',
    selectedStatsTeamFilter: 'all', // 'all', 'A', or 'B'
    playerCard: { isOpen: false, playerId: null, selectedSeasonId: 'all-time' },
    fixture: { id: null, games: [], activeGameIndex: 0 },
    allFixtures: [],
    previousFixtures: [],
    upcomingFixtures: [],
    selectedPreviousFixtureId: null,
    selectedUpcomingFixtureId: null,
    activeFixturesTab: 'upcoming',
    currentGameIndex: 0,
    lastTurnSeq: 0,
    confirmation: { action: null, data: null },
    loginAttemptRole: null,
    logoutTimer: null,
    h2h: {
        player1: null,
        player2: null,
        selectedSeason: 'all-time',
    },
    myProfile: {
        selectedPlayerId: null,
    },
    pendingFine: {
        amount: null,
        reason: null
    },
    leaderboardSort: { 
        column: 'gamesWon',
        direction: 'desc' 
    },
    columnVisibility: { 
        gamesPlayed: false,
        gamesWon: true,
        gamesLost: false,
        legsWon: true,
        legsLost: false,
        legWinPercent: true,
        scores100: true,
        scores140: false,
        scores180: true,
        highCheckout: true,
        totalFines: false
    }
};