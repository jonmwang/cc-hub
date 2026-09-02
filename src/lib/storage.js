// ─────────────────────────────────────────────────────────────────────────────
// Storage adapters.
//
// Everything the app persists goes through this interface. Today the only
// implementation is browser localStorage. When you are ready to sync between
// you and your partner for real, write a second adapter with the same four
// methods and change ONE line in `getAdapter()` below — no page or component
// touches storage directly.
//
//   load()            -> Promise<state | null>
//   save(state)       -> Promise<void>
//   subscribe(fn)     -> unsubscribe function, called when remote data changes
//   describe()        -> { mode, detail } for the status pill in the header
//
// A sketch of the Firestore version lives in REMOTE_ADAPTER_NOTES.md.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cc-hub/v1'
// The app was briefly called Points HQ. Anything saved under the old key gets
// adopted on first load so early data isn't stranded by the rename.
const LEGACY_KEYS = ['points-hq/v1']

class LocalStorageAdapter {
  async load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw)

      for (const legacy of LEGACY_KEYS) {
        const old = window.localStorage.getItem(legacy)
        if (!old) continue
        window.localStorage.setItem(STORAGE_KEY, old)
        window.localStorage.removeItem(legacy)
        return JSON.parse(old)
      }
      return null
    } catch {
      return null
    }
  }

  async save(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Private browsing or a full quota. Nothing actionable; keep the app alive.
    }
  }

  subscribe(onChange) {
    // Keeps two tabs on the same machine in step.
    const handler = (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        onChange(JSON.parse(e.newValue))
      } catch {
        /* ignore malformed writes */
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }

  describe() {
    return { mode: 'local', detail: 'Saved in this browser' }
  }
}

// ─────────────────────────── Sync credentials ────────────────────────────────
// A household id plus an encryption key. The id identifies the Firestore
// document; the key never leaves the browser. Both arrive via the invite link's
// fragment and are then kept locally so the app reconnects on its own.

const SYNC_KEY = 'cc-hub/sync'

export function getSyncCreds() {
  try {
    const raw = window.localStorage.getItem(SYNC_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setSyncCreds(creds) {
  try {
    if (creds) window.localStorage.setItem(SYNC_KEY, JSON.stringify(creds))
    else window.localStorage.removeItem(SYNC_KEY)
  } catch {
    /* private browsing */
  }
}

// Reads `#/...?sync=<householdId>.<key>` and strips it from the address bar so
// the key isn't left sitting in the URL after it's been stored.
export function consumeSyncLink() {
  const hash = window.location.hash
  const qIndex = hash.indexOf('?')
  if (qIndex === -1) return null

  const params = new URLSearchParams(hash.slice(qIndex + 1))
  const payload = params.get('sync')
  if (!payload) return null

  const [householdId, keyString] = payload.split('.')
  params.delete('sync')
  const rest = params.toString()
  const path = hash.slice(0, qIndex)
  window.history.replaceState(null, '', `${window.location.pathname}${path}${rest ? `?${rest}` : ''}`)

  if (!householdId || !keyString) return null
  const creds = { householdId, keyString }
  setSyncCreds(creds)
  return creds
}

export function buildSyncUrl({ householdId, keyString }) {
  const base = `${window.location.origin}${window.location.pathname}`
  // Fragment, not query string — fragments are never sent to a server, which is
  // what keeps the encryption key off Google's wire entirely.
  return `${base}#/?sync=${householdId}.${keyString}`
}

let adapter = null

export function getAdapter() {
  if (!adapter) adapter = new LocalStorageAdapter()
  return adapter
}

export function setAdapter(next) {
  adapter = next
}

export function localAdapter() {
  return new LocalStorageAdapter()
}

// ─────────────────────────── Share links & backups ───────────────────────────
// A share link carries the whole state in the URL fragment, so sending your
// partner a link genuinely hands her your setup with no server involved.

// ── Payload shaping ──────────────────────────────────────────────────────────
// A share link has to survive being pasted into iMessage, WhatsApp, email. Those
// stop auto-linking somewhere around 2,000 characters, and a link that breaks
// mid-string arrives as a dead half-link with a stray "=..." after it.
//
// The raw state JSON is ~1.8 KB, which base64s to a 2.4 KB URL — right in the
// danger zone. So the payload is squeezed twice before encoding: field names are
// shortened to single letters, then the whole thing is deflated. Together that
// lands around 500 characters, which every client handles.

function pack(state) {
  return {
    v: state.version,
    // Wallet entries are the bulk of the payload; drop the derived `key` and
    // omit openDate entirely when it isn't set.
    w: state.wallet.map((x) => (x.openDate ? [x.cardId, x.ownerId, x.openDate] : [x.cardId, x.ownerId])),
    pe: state.people,
    va: state.valuations,
    s: state.settings,
    r: state.rotating,
    m: state.merchantRules,
    cv: state.creditValues,
    cu: state.creditsUsed,
    cl: state.creditsLog,
  }
}

function unpack(p) {
  // Anything from an older link shape falls through to the migration in the store.
  if (!p || typeof p !== 'object') return null
  if (!Array.isArray(p.w)) return p // already a full state object (legacy link)
  return {
    version: p.v,
    wallet: p.w.map(([cardId, ownerId, openDate = null]) => ({
      key: `${cardId}__${ownerId}`,
      cardId,
      ownerId,
      openDate,
    })),
    people: p.pe,
    valuations: p.va,
    settings: p.s,
    rotating: p.r,
    merchantRules: p.m,
    creditValues: p.cv,
    creditsUsed: p.cu,
    creditsLog: p.cl,
  }
}

async function deflate(str) {
  const cs = new CompressionStream('deflate-raw')
  const writer = cs.writable.getWriter()
  writer.write(new TextEncoder().encode(str))
  writer.close()
  return new Uint8Array(await new Response(cs.readable).arrayBuffer())
}

async function inflate(bytes) {
  const ds = new DecompressionStream('deflate-raw')
  const writer = ds.writable.getWriter()
  writer.write(bytes)
  writer.close()
  return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer())
}

function bytesToBase64Url(bytes) {
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(b64) {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

export async function buildShareUrl(state) {
  const base = `${window.location.origin}${window.location.pathname}`
  const payload = bytesToBase64Url(await deflate(JSON.stringify(pack(state))))
  // Kept in the fragment rather than the query string: fragments are never sent
  // to the server, so the card setup never lands in GitHub's request logs.
  return `${base}#/?s=${payload}`
}

// Reads and strips a share payload from the hash route. Accepts the current
// compressed `s=` form and the original uncompressed `share=` links.
export async function consumeSharedStateFromUrl() {
  const hash = window.location.hash
  const qIndex = hash.indexOf('?')
  if (qIndex === -1) return null

  const params = new URLSearchParams(hash.slice(qIndex + 1))
  const compressed = params.get('s')
  const legacy = params.get('share')
  if (!compressed && !legacy) return null

  let decoded = null
  try {
    if (compressed) {
      decoded = unpack(JSON.parse(await inflate(base64UrlToBytes(compressed))))
    } else {
      decoded = unpack(JSON.parse(new TextDecoder().decode(base64UrlToBytes(legacy))))
    }
  } catch {
    decoded = null
  }

  params.delete('s')
  params.delete('share')
  const rest = params.toString()
  const path = hash.slice(0, qIndex)
  window.history.replaceState(null, '', `${window.location.pathname}${path}${rest ? `?${rest}` : ''}`)

  return decoded
}

export function downloadBackup(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cc-hub-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
