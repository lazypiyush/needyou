import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase only in browser environment
let firebaseApp: FirebaseApp | undefined;
let firebaseAuth: Auth | undefined;
let firebaseDb: Firestore | undefined;
let firebaseGoogleProvider: GoogleAuthProvider | undefined;

if (typeof window !== 'undefined') {
  // Check if Firebase is already initialized
  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApps()[0];
  }

  firebaseAuth = getAuth(firebaseApp);
  firebaseGoogleProvider = new GoogleAuthProvider();
  firebaseDb = getFirestore(firebaseApp);
}

// Export with non-null assertions since these are only used in client components
export const auth = firebaseAuth as Auth;
export const googleProvider = firebaseGoogleProvider as GoogleAuthProvider;
export const db = firebaseDb as Firestore;

