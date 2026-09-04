# Turning on live sync

Real-time sync between your devices and your partner's, with the data
**end-to-end encrypted** — the database holds ciphertext and nothing else.

About 5 minutes, one time. Free, and no card required.

---

## What the server can and can't see

Everything is encrypted in your browser before it is sent, with AES-256-GCM.
Firestore stores only `{ iv, data }` — random-looking bytes.

The encryption key lives in the **URL fragment** of your household link
(`#/?sync=…`). Browsers never transmit the fragment: not in the request, not in
the `Referer` header. So the key reaches your partner's browser without ever
reaching Google.

| | Can read your data |
|---|---|
| You and your partner (have the link) | yes |
| Google / Firebase | **no** |
| Anyone who breaches the database | **no** |
| Anyone who finds the public repo | **no** |

**The flip side, stated plainly:** lose every copy of the link and the data is
gone for good. Nobody can recover a key they never had. Keep a JSON backup from
the Settings page.

---

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and sign in.
2. **Create a project** → name it anything (`cc-hub` works) → you can disable
   Google Analytics, it isn't used.
3. In the left sidebar: **Build → Firestore Database → Create database**.
4. Choose a location near you. Start in **production mode**, not test mode.

   Test mode writes `allow read, write: if request.time < <30 days from now>` —
   your database is open to the whole internet for a month, and then silently
   denies everything, breaking sync with no obvious cause. Production mode
   starts at `if false`, locked from the first second. You replace the rule
   either way in the next step.

   **Publish the rules below before turning sync on**, or the app will get
   `permission-denied`. That's a loud, immediate failure rather than a delayed
   one, which is the point of starting locked.

## 2. Register a web app and copy the config

1. Project settings (the gear, top-left) → scroll to **Your apps**.
2. Click the **web** icon (`</>`), give it a nickname, **Register app**.
3. You'll see a `firebaseConfig` object. Copy the values into
   `src/lib/sync/firebaseConfig.js`:

```js
export const FIREBASE_CONFIG = {
  apiKey: 'AIza…',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  appId: '1:123…:web:abc…',
}
```

**These are not secrets.** Firebase web config is public by design — it names
the project, it doesn't grant anything. Google's own docs say to ship it in
client code. Committing it to a public repo is fine.

## 3. Set the security rules

Firestore → **Rules** tab. Replace what's there with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /households/{householdId} {

      // Only the encrypted shape is accepted, so the database can't be used as
      // free general-purpose storage by anyone who finds the project id.
      function validPayload() {
        return request.resource.data.keys().hasOnly(['iv', 'data', 'updatedAt', 'v'])
            && request.resource.data.iv is string
            && request.resource.data.data is string
            && request.resource.data.data.size() < 200000;
      }

      // Fetching one household by its id is fine: the id is 128 bits of
      // randomness and the contents are ciphertext.
      allow get: if true;

      // Listing the collection is NOT fine. `allow read` would permit both get
      // and list, and a list lets anyone pull every household document without
      // knowing a single id. Still ciphertext, but there is no reason to hand
      // out a pile of it.
      allow list: if false;

      allow create, update: if validPayload();

      // Deletes carry no payload, so a shape check can't gate them. Nobody
      // needs to delete from the app — do it from the Firebase console.
      allow delete: if false;
    }

    // The spoken answer sheet for the Siri shortcut. PLAINTEXT and deliberately
    // so: stock macOS cannot decrypt AES-GCM (LibreSSL lists the cipher but
    // fails at runtime, and /usr/bin/python3 has no crypto module), so a shell
    // script physically cannot read the encrypted document above.
    //
    // It holds only "category -> card name" lines. Valuations, fees, credit
    // values, usage history and names all stay in the encrypted document.
    match /answers/{householdId} {
      allow get: if true;
      allow list: if false;
      allow create, update: if
        request.resource.data.keys().hasOnly(['b64', 'updatedAt', 'v'])
        && request.resource.data.b64 is string
        && request.resource.data.b64.size() < 20000;
      allow delete: if false;
    }
  }
}
```

**Publish.**

If you'd rather have hard access control than an unguessable id, add Firebase
Auth with Google sign-in and gate on `request.auth != null` plus a membership
check. More setup, and the encryption already means the stored bytes are
useless to anyone else — but the option is there.

## 4. Deploy and switch it on

```bash
npm run build && git add -A && git commit -m "Add Firebase config" && git push
```

Then on the live site: **Settings & Sharing → Live sync → Turn on live sync**.

You'll get a household link. Open it on your phone, and send it to your partner
**privately** — that link *is* the key. Anyone holding it can read and edit.

---

## How it behaves

- **Writes are debounced 800ms.** Dragging a valuation slider would otherwise
  fire a write per frame.
- **Credit ticks never collide.** The usage log is append-only and merged as a
  union keyed by (card, credit, period), so if you and your partner tick
  different credits at the same moment, both survive. Naive last-write-wins
  would silently drop one — the worst possible failure here, because you'd never
  notice.
- **Everything else is last-write-wins**, which needs both of you changing the
  same setting within a second. The loss is a preference, not a record.
- **A local copy is always kept too.** If the link is ever lost, the encrypted
  remote copy is unrecoverable, but the browser still has its own copy.
- **Offline works.** Firestore caches locally and reconciles on reconnect.

## Free tier

Spark plan, no billing account required: 1 GiB stored, 50K reads/day, 20K
writes/day, 10 GiB/month egress.

This app stores **one document of a few KB** and, on a busy day, generates maybe
50–100 writes. That's under 1% of the daily allowance. With no card on file you
cannot be billed; in the impossible event you exceeded a quota, requests would
pause until the daily reset rather than cost anything.

## Turning it off

**Stop syncing on this device** in Settings. Local data stays, and any other
device still on the household keeps working. To wipe the cloud copy entirely,
delete the `households` document in the Firebase console.
