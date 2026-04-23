import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const isDevelopment = location.hostname.includes('github.dev') || location.hostname.includes('codespaces') || location.hostname.includes('app.github.dev') || location.hostname.includes('localhost');

const firebaseConfig = isDevelopment
    ? {
        apiKey: "AIzaSyC6Ctix8MZtCj6AkWCLkwtZPayOidXLITA",
        authDomain: "burnabydartsdev.firebaseapp.com",
        projectId: "burnabydartsdev",
        storageBucket: "burnabydartsdev.firebasestorage.app",
        messagingSenderId: "372591363063",
        appId: "1:372591363063:web:84fee08add7b4d1abce4f2"
      }
    : {
        apiKey: "AIzaSyCU66DqSCzkwaEhTLEOftEJtKbt9y4xVeI",
        authDomain: "darts-app-9e752.firebaseapp.com",
        databaseURL: "https://darts-app-9e752-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "darts-app-9e752",
        storageBucket: "darts-app-9e752.appspot.com",
        messagingSenderId: "520662271304",
        appId: "1:520662271304:web:abb1ca68445511c8bb1f7d"
      };

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
provider.addScope('email');
provider.addScope('profile');