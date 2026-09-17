import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

// Inisialisasi Firebase mengikut SES v4.5 Singleton Pattern
const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Gunakan firestoreDatabaseId jika disediakan oleh AI Studio environment
export const db: Firestore = firebaseConfigData.firestoreDatabaseId
  ? getFirestore(app, firebaseConfigData.firestoreDatabaseId)
  : getFirestore(app);

export default app;

/**
 * Pengendalian ralat seragam Firestore (Error Handling SES v4.5)
 */
export function handleFirebaseError(error: unknown, contextMsg: string): string {
  console.error(`[FirebaseError] ${contextMsg}:`, error);
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Email atau kata laluan tidak sah. Sila semak semula maklumat anda.';
      case 'auth/email-already-in-use':
        return 'Email ini telah didaftarkan dalam sistem NFC Mobile Access KPMBP.';
      case 'auth/weak-password':
        return 'Kata laluan terlalu lemah. Gunakan sekurang-kurangnya 6 aksara.';
      case 'auth/invalid-email':
        return 'Format alamat email tidak sah.';
      case 'auth/unauthorized-domain': {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'domain ini';
        return `Domain '${domain}' belum didaftarkan dalam senarai Authorized Domains Firebase Authentication. Sila tambah domain ini di Firebase Console (Authentication > Settings > Authorized domains), atau daftar/log masuk menggunakan Email Rasmi & Kata Laluan di bawah.`;
      }
      case 'auth/popup-closed-by-user':
        return 'Tetingkap log masuk Google telah ditutup sebelum pengesahan selesai.';
      case 'auth/cancelled-popup-request':
        return 'Permintaan tetingkap log masuk Google telah dibatalkan.';
      case 'permission-denied':
        return 'Akses disekat: Kebenaran ditolak oleh Firestore Security Rules (SES-SEC-4.5.5).';
      case 'unavailable':
        return 'Perkhidmatan Firebase tidak dapat dihubungi. Periksa sambungan internet.';
      default:
        return (error as { message?: string }).message || 'Ralat perkhidmatan Firebase.';
    }
  }
  return error instanceof Error ? error.message : 'Ralat yang tidak dijangka berlaku.';
}
