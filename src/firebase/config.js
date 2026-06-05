import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCv5WBqfrgcCAA1KQxArGE2bHCvGqnzioM",
  authDomain: "oak-street-logistics-llc-crm.firebaseapp.com",
  projectId: "oak-street-logistics-llc-crm",
  storageBucket: "oak-street-logistics-llc-crm.firebasestorage.app",
  messagingSenderId: "121430618718",
  appId: "1:121430618718:web:7b56bbbc3b1c5e5827facf",
  measurementId: "G-Q0HCK0VJXP"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
