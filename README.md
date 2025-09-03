# Burnaby Arms B Darts Scorer

## Overview
The Burnaby Arms B Darts Scorer is a web application for managing darts matches for the Burnaby Arms B team. It provides tools to set up fixtures, track live scores, handle player fines, and view statistics. The app is built with vanilla JavaScript, Tailwind CSS, and Firebase (Authentication and Firestore).

## Local Setup

### Prerequisites
- [Node.js](https://nodejs.org/) and npm
- [Firebase CLI](https://firebase.google.com/docs/cli#setup) installed globally (`npm install -g firebase-tools`)

### Steps
1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd BurnabyDarts
   ```
2. **Configure Firebase**
   - Create a Firebase project in the [Firebase console](https://console.firebase.google.com/).
   - Enable **Authentication** (Google sign-in) and **Firestore**.
   - From your project settings, copy the web app configuration and replace the `firebaseConfig` object in `src/firebase/init.js` with your project's credentials.
3. **Serve the app locally**
   - The app now uses native ES modules. Serve the project over a local web server:
     ```bash
     npx serve .
     # or
     python3 -m http.server
     ```
   - Navigate to the provided URL (e.g. `http://localhost:5000`) to use the app.

## Usage
- Select your role or sign in with Google to access the app.
- When creating an account, provide your name; it will appear in the admin user list.
- Set up fixtures, record match scores, manage fines, and view player statistics.
- Data is stored in your configured Firebase project.

## Deployment
1. Log in and initialize Firebase Hosting:
   ```bash
   firebase login
   firebase init hosting
   ```
2. Deploy the static files:
   ```bash
   firebase deploy
   ```
   The site can also be deployed to any static hosting provider.

## Contributing
Contributions are welcome! To contribute:
1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Commit your changes and open a pull request.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments
- Burnaby Arms B darts team.
- [Tailwind CSS](https://tailwindcss.com/).
- [Firebase](https://firebase.google.com/).
