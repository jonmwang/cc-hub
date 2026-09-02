// ─────────────────────────────────────────────────────────────────────────────
// Firebase web config for live sync.
//
// From: console.firebase.google.com → Project settings → Your apps → Web app.
//
// These values are NOT secrets. Firebase web config is public by design — it
// identifies the project, it doesn't authorise anything. Google's own docs say
// to ship it in client code, and it's visible in the built bundle regardless.
// It is safe in a public repo.
//
// What actually protects the data is two things:
//   1. Everything is encrypted in this browser before it is sent, with a key
//      that never leaves your devices. The database holds only ciphertext.
//   2. Firestore security rules — see SYNC_SETUP.md. Those must be published
//      before sync will work; production mode denies everything until they are.
//
// Blank this out and the app silently reverts to local-only storage.
// ─────────────────────────────────────────────────────────────────────────────

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBL6cCanXn_DCfZXWp_hOXQs88yquNjhg0',
  authDomain: 'cc-hub-dc00e.firebaseapp.com',
  projectId: 'cc-hub-dc00e',
  storageBucket: 'cc-hub-dc00e.firebasestorage.app',
  messagingSenderId: '631611643846',
  appId: '1:631611643846:web:a709332154105f4ab844c7',
}

export const isConfigured = () =>
  Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId)
