# Going multiplayer: swapping local storage for real sync

Right now every browser keeps its own copy of the data. This is how you'd change
that when you're ready — and why it should stay a small change.

## The seam

Every read and write in the app goes through the adapter interface in
`src/lib/storage.js`:

```js
load()          // -> Promise<state | null>
save(state)     // -> Promise<void>
subscribe(fn)   // -> unsubscribe fn; called when data changes remotely
describe()      // -> { mode, detail } for the header pill
```

No page or component touches `localStorage` directly. So a second adapter with
those same four methods, plus one changed line in `getAdapter()`, is the whole
migration. **If you find yourself editing files under `src/pages/`, something has
gone wrong** — the seam is doing its job only if they stay untouched.

## Firebase version

Firestore is the easiest fit: its `onSnapshot` maps directly onto `subscribe`,
which is what gives you live updates rather than a snapshot.

```bash
npm install firebase
```

```js
// src/lib/firebaseAdapter.js
import { initializeApp } from 'firebase/app'
import { doc, getDoc, getFirestore, onSnapshot, setDoc } from 'firebase/firestore'

const app = initializeApp({
  // From the Firebase console: Project settings -> Your apps -> Web app.
  // These keys are safe to commit; Firestore rules are what protect the data.
  apiKey: '...',
  projectId: '...',
  appId: '...',
})

const db = getFirestore(app)

export class FirestoreAdapter {
  constructor(householdId) {
    this.ref = doc(db, 'households', householdId)
  }

  async load() {
    const snap = await getDoc(this.ref)
    return snap.exists() ? snap.data().state : null
  }

  async save(state) {
    await setDoc(this.ref, { state, updatedAt: Date.now() })
  }

  subscribe(onChange) {
    return onSnapshot(this.ref, (snap) => {
      if (snap.exists() && !snap.metadata.hasPendingWrites) onChange(snap.data().state)
    })
  }

  describe() {
    return { mode: 'cloud', detail: 'Synced' }
  }
}
```

Then in `storage.js`:

```js
export function getAdapter() {
  if (!adapter) adapter = new FirestoreAdapter(householdIdFromUrl())
  return adapter
}
```

### Setup steps

1. Create a free project at <https://console.firebase.google.com>.
2. Build → Firestore Database → Create database.
3. Project settings → Your apps → Web → copy the config object above.
4. Drop the adapter in and flip `getAdapter()`.

### The household ID

Simplest approach that needs no login: put a long random ID in the URL, e.g.
`#/quick-picks?h=8f3a...`. Anyone with the link edits the same document; anyone
without it can't guess it. Read `h` once at startup and stash it in
`localStorage` so it survives navigation.

That is security-by-obscure-URL, which is fine for card nicknames and credit
checkboxes but **not** if you ever store account or card numbers. Don't.

If you'd rather have real accounts, add Firebase Auth with Google sign-in and key
the document off a household the signed-in user belongs to. More setup, proper
access control.

### Firestore rules

The default rules lock everything down. For the URL-key approach:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /households/{householdId} {
      allow read, write: if true;  // security rests entirely on the unguessable ID
    }
  }
}
```

With Auth instead, replace the condition with a real membership check.

## Things worth handling once it's live

- **Write throttling.** `save()` currently fires on every state change — every
  slider drag included. Debounce it (say 500ms) before pointing it at a network,
  or you'll burn quota fast.
- **Conflicts.** Two people editing at once means last-write-wins on the whole
  document. Fine for this app; if it starts to bite, split state into per-section
  documents so a credit checkbox and a valuation slider stop colliding.
- **Offline.** Firestore caches locally by default, so the app keeps working on a
  plane and reconciles later.

## Supabase instead?

Equally workable. `load`/`save` become a `select`/`upsert` on a `households`
table, and `subscribe` uses a realtime channel on that row. Choose it if you'd
rather have Postgres and SQL than a document store; the adapter shape is
identical either way.
