// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDjo4uBGE-q-0307deHytf6fZOvP5ahX_I",
  authDomain: "neocloud-6c8af.firebaseapp.com",
  projectId: "neocloud-6c8af",
  storageBucket: "neocloud-6c8af.firebasestorage.app",
  messagingSenderId: "697224243582",
  appId: "1:697224243582:web:e801d6007519d26dad6b2f",
  measurementId: "G-SSQ23QSWYW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
export const auth = getAuth(app);
export const db = getFirestore(app);