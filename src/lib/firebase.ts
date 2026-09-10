import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import rawFirebaseConfig from '../../firebase-applet-config.json';

// Support both firebase-applet-config.json and runtime environment variables (for GitHub/VPS deployment)
export const firebaseConfig = {
  projectId: rawFirebaseConfig?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  appId: rawFirebaseConfig?.appId || import.meta.env.VITE_FIREBASE_APP_ID || '',
  apiKey: rawFirebaseConfig?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: rawFirebaseConfig?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  firestoreDatabaseId:
    rawFirebaseConfig?.firestoreDatabaseId || import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '',
  storageBucket:
    rawFirebaseConfig?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId:
    rawFirebaseConfig?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Use custom firestoreDatabaseId if configured in project, otherwise fallback to default
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export default app;
