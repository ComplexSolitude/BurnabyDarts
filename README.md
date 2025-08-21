# Burnaby_Arms_B

This project is a web-based scoring app for the Burnaby Arms darts team. It uses
Firebase for data storage and authentication and runs as a static HTML/JavaScript
site.

## Features

- Create and manage fixtures with singles or doubles games
- Real-time score entry with fines and high-checkout tracking
- Player profiles, leaderboards and head-to-head statistics
- Role-based access (viewer, scorer, admin) with Google authentication
- Responsive design with light and dark modes

## Prerequisites

- **Node.js** v20 or later
- **npm** (comes with Node)
- A **Firebase** project with Firestore and Authentication enabled
- The **Firebase CLI** (`npm install -g firebase-tools`)

Copy your Firebase configuration into [`index.html`](index.html) replacing the
existing `firebaseConfig` object.

## Running Locally

1. Clone the repository and install the Firebase CLI.
2. Update the Firebase configuration in `index.html` to match your project.
3. Serve the site using any static server, for example:

   ```bash
   npx serve .
   ```

   or with the Firebase CLI:

   ```bash
   firebase emulators:start --only hosting
   ```
4. Open the provided localhost URL in your browser.

## Deployment

1. Ensure you are logged in: `firebase login`.
2. Initialise hosting (first time only): `firebase init hosting` and select this
   repository directory.
3. Deploy to Firebase Hosting:

   ```bash
   firebase deploy --only hosting
   ```

## Contribution Guidelines

Contributions are welcome!

1. Fork the repository and create a topic branch from `main`.
2. Make your changes and ensure they are documented.
3. Run tests or `npm test` (if available) and perform manual checks before
   submitting.
4. Open a pull request describing your changes.

---

Burnaby Arms B Darts App © 2024
