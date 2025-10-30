
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAUpKh17YNDSZNJCOkIJATAk3CclHm_CNI",
  authDomain: "business-inventory-syste-14340.firebaseapp.com",
  projectId: "business-inventory-syste-14340",
  storageBucket: "business-inventory-syste-14340.appspot.com",
  messagingSenderId: "522961393427",
  appId: "1:522961393427:web:360da6317ca06c7b93ace6"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
