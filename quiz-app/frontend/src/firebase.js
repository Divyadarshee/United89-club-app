import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCVp594g3jq7-BXxRT7WquH612NSreYKcc',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'gen-lang-client-0899905004.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0899905004',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'gen-lang-client-0899905004.firebasestorage.app',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '432448119899',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:432448119899:web:b8e072230c8500d3ce0b7e',
    measurementId: 'G-97LL5T1C1R'
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

console.log('[Firebase Init] Project:', firebaseConfig.projectId);
console.log('[Firebase Init] App ID:', firebaseConfig.appId);
console.log('[Firebase Init] Auth Domain:', firebaseConfig.authDomain);

export default app;
