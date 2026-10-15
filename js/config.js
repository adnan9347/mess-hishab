/**
 * Paste your Firebase web config here (Firebase console → Project settings → Your apps).
 * While apiKey is empty the app runs in DEMO mode: everything is stored in this browser,
 * so you can review every screen without a Firebase project.
 */
export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};

export const FIREBASE_SDK_VERSION = '11.0.2';

const forceDemo = new URLSearchParams(location.search).has('demo');

export const MODE = FIREBASE_CONFIG.apiKey && !forceDemo ? 'firebase' : 'demo';

export const DEMO_ACCOUNT = Object.freeze({ email: 'demo@messhishab.app', password: 'demo1234' });
