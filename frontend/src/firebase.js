import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBuclePsteO9bcdLqOjYZ3dWk9_9sRa4d4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "cortexai-77b02.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "cortexai-77b02",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "cortexai-77b02.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "704066540343",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:704066540343:web:241661b63e3de807dc80b2",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-WQ8H5NKCXS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider };
