import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAAui6to50EbfNdpU2nC72jI84REh8lmbs",
  authDomain: "teacher-voting.firebaseapp.com",
  projectId: "teacher-voting",
  storageBucket: "teacher-voting.firebasestorage.app",
  messagingSenderId: "455870516244",
  appId: "1:455870516244:web:cbbbc466e9169061b5ab01",
  measurementId: "G-QXB80E11ZY"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);