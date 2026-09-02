// ─────────────────────────────────────────────────────────────────────────────
// Paste your Firebase web config here to turn on live sync.
//
// Get it from: console.firebase.google.com → your project → Project settings
// (gear icon) → "Your apps" → Web app → Config.
//
// These values are NOT secrets. Firebase web config is public by design — it
// identifies the project, it doesn't authorise anything. Google's own docs say
// to ship it in client code. It is safe in a public repo.
//
// What actually protects the data here is two things:
//   1. Everything is encrypted in your browser before it is sent, with a key
//      that never leaves your devices. The database holds ciphertext.
//   2. Firestore security rules restrict access to the sync collection.
//
// While this is left blank the app just uses local storage, exactly as before.
// ─────────────────────────────────────────────────────────────────────────────

export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
}

export const isConfigured = () =>
  Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId)
