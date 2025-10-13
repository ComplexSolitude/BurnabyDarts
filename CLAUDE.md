# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Burnaby Arms B Darts Scorer is a single-page web application for managing darts matches. It's built as a vanilla JavaScript application with all code contained in a single `index.html` file (~330KB). The app uses Firebase (Authentication and Firestore) for backend services and Tailwind CSS for styling.

## Development Commands

### Local Development
```bash
# Serve the app locally (recommended approach)
npx serve .

# Alternative: Python HTTP server
python3 -m http.server
```

### Firebase Deployment
```bash
# Login and initialize (first time only)
firebase login
firebase init hosting

# Deploy to Firebase Hosting
firebase deploy
```

## Architecture

### Single-File Structure
The entire application is contained in `index.html` with the following internal organization:

1. **HTML Structure** (lines 1-798): Layout with tab-based navigation system
2. **Firebase SDK Imports** (lines 799-819): ES6 module imports from CDN
3. **Application State** (lines 820-876): Global `state` object containing all app state
4. **Security Layer** (lines 878-969): Rate limiting, input validation, XSS protection
5. **Constants & DOM Elements** (lines 972-1090): Configuration and UI element references
6. **Render Functions** (lines 1092+): UI rendering logic for each tab/view
7. **Event Handlers & Business Logic** (lines 3000+): User interactions and Firebase operations
8. **Initialization** (lines 4737+): `init()` function and event listener setup

### State Management
All application state is centralized in a single `state` object (index.html:820-876):

```javascript
const state = {
    db: null,              // Firestore instance
    auth: null,            // Firebase Auth instance
    userId: null,
    userRole: null,        // 'viewer', 'member', 'admin'
    userTeam: null,        // 'A' or 'B'
    activeTab: 'match',
    players: [],           // Synced from Firestore
    seasons: [],           // Synced from Firestore
    fixture: {},           // Current active match
    previousFixtures: [],
    upcomingFixtures: []
    // ... additional state properties
};
```

State updates trigger re-renders via the main `render()` function (index.html:1093).

### Firebase/Firestore Schema

**Collections:**
- `players`: Player profiles with names and archived status
- `fixtures`: Match data including games, scores, fines, and status ('scheduled', 'live', 'finished')
- `seasons`: Season management with 'active' or 'archived' status
- `users`: User accounts with roles, team assignments, and linked player IDs
- `audit_logs`: Admin action tracking

**Fixture Document Structure:**
```javascript
{
    oppositionName: string,
    team: 'A' | 'B',
    status: 'scheduled' | 'live' | 'finished',
    seasonId: string,
    activeGameIndex: number,
    games: [
        {
            title: string,              // e.g., "Singles 1", "Doubles 1"
            type: 'singles' | 'doubles',
            playerIds: string[],
            legsWon: number,
            legsLost: number,
            highCheckout: number,
            playerScores: [{
                scores100: number,
                scores140: number,
                scores180: number,
                sillyThings: number
            }],
            fines: [{
                playerId: string,
                amount: number,
                reason: string,
                isPaid: boolean
            }],
            turnSeq: number,
            winner: string | null
        }
    ],
    dotdPlayerId: string,    // Darts of the Day winner
    createdAt: Timestamp,
    scheduledDate: Timestamp
}
```

### Real-Time Data Synchronization
The app uses Firestore `onSnapshot` listeners (index.html:4936-4998) to maintain real-time sync:

```javascript
function setupFirestoreListeners() {
    // Listeners for seasons, players, and fixtures collections
    // Updates state and triggers re-render on any changes
    // Properly unsubscribes old listeners to prevent memory leaks
}
```

These listeners are established in the `init()` function and automatically update `state.players`, `state.seasons`, and fixture-related state when Firestore data changes.

### Tab-Based Navigation
The UI uses a tab system (index.html:577-616) with these main tabs:
- **Match**: Create/start new fixtures
- **Live**: Active match scoring interface
- **Fixtures**: View upcoming and completed matches
- **Fines**: Track player fines
- **Stats**: Player statistics and leaderboard
- **H2H**: Head-to-head player comparisons
- **My Profile**: User profile management
- **Setup**: Team/season configuration (members only)
- **Admin**: User and season management (admins only)

Tab switching is handled by `switchTab(tabName)` (index.html:3577) which updates `state.activeTab` and calls `render()`.

### Role-Based Permissions
The app has four user roles with different capabilities:

- **Viewer**: Read-only access, no authentication required
- **Scorer**: Can score matches but not create/edit fixtures (deprecated, treat as member)
- **Member**: Can create fixtures, score matches, and manage team settings
- **Admin**: Full access including user management and season control

Permission checks are enforced in functions like `createFixture()`, `addPlayer()`, and admin-only operations.

### Security Features
- **Rate Limiting**: `rateLimiter` object (index.html:878-902) prevents abuse (50 requests/minute per operation)
- **Input Validation**: `validateInput()` (index.html:911-937) checks for XSS patterns
- **Storage Validation**: `validateStoredData()` (index.html:940-969) verifies localStorage integrity
- **CSP Headers**: Strict Content Security Policy defined in HTML meta tags
- **Firebase Security Rules**: Backend rules should be configured in Firebase Console

## Key Functions and Patterns

### Creating a Match
1. User fills in opposition name and players via autocomplete dropdowns
2. `createFixture()` (index.html:4017) validates inputs and permissions
3. `getOrCreatePlayer()` (index.html:3658) handles player autocreation
4. Document created in `fixtures` collection with status 'live'
5. Firestore listener updates `state.fixture` and triggers render

### Scoring During a Match
1. Live match UI renders via `renderLiveMatch()` (index.html:2392)
2. User clicks buttons to record legs, high scores, checkouts
3. `updateStat()` (index.html:4149) modifies game data in state
4. `updateGameData()` (index.html:4129) saves to Firestore
5. Real-time updates appear for all connected users

### Finishing a Match
1. User clicks "Finish Match" button
2. `openDotdModal()` (index.html:4515) displays player selection modal
3. `finishMatch(dotdPlayerId)` (index.html:4293) updates fixture status to 'finished'
4. Match moves from active to previous fixtures
5. All connected users see the update immediately

## Important Considerations

### Modifying the Codebase
- All code is in one file, so changes can have wide-ranging effects
- Always test the full user flow after making changes
- The file is large (~330KB); use search/grep to locate specific functions
- Maintain the existing code organization sections marked by `// ---` comments

### Firebase Configuration
- Firebase config is hardcoded in index.html (around line 800-850)
- For local development, developers need to replace with their own Firebase project credentials
- Firebase security rules must be configured separately in the Firebase Console

### Adding New Features
1. Add new state properties to the `state` object if needed
2. Create render functions for new UI components
3. Add event handlers in the `init()` function or delegated listeners
4. Use `safeFirebaseCall()` wrapper for all Firestore operations
5. Call `render()` after state changes to update the UI
6. Trigger haptic feedback with `triggerHaptic()` for better mobile UX

### Common Patterns
- **Toast notifications**: `showToast(message, type)` for user feedback
- **Confirmation dialogs**: `openConfirmModal()` for destructive actions
- **Permission checks**: Always verify `state.userRole` and `state.isLoggedIn`
- **Data validation**: Use `validateInput()` for all user-provided strings
- **Rate limiting**: Wrap Firebase calls with `safeFirebaseCall(operation, fn)`

## Testing
There are no automated tests in this repository. Manual testing is required:

1. Test as viewer (no login required)
2. Test as member (create account or sign in)
3. Test as admin (requires admin role in Firestore users collection)
4. Test match creation, scoring, and finishing flows
5. Test across different teams (A and B)
6. Verify real-time updates work across multiple browser windows

## Team Management
The app supports two teams (A and B). The active team is determined by:
- **Members**: `state.userTeam` (set in user profile)
- **Viewers**: `state.activeMatchView` (can toggle between teams)
- **Admins**: Can view/manage both teams and see setup tab if any team has an active match

Fixtures are team-specific, with filters applied in the Firestore listeners based on the user's team context.
