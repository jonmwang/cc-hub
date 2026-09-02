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

let adapter = null

export function getAdapter() {
  if (!adapter) adapter = new LocalStorageAdapter()
  return adapter
}

// ─────────────────────────── Share links & backups ───────────────────────────
// A share link carries the whole state in the URL fragment, so sending your
// partner a link genuinely hands her your setup with no server involved.

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(b64) {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeStateToParam(state) {
  return toBase64Url(JSON.stringify(state))
}

export function decodeStateFromParam(param) {
  try {
    return JSON.parse(fromBase64Url(param))
  } catch {
    return null
  }
}

export function buildShareUrl(state) {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#/?share=${encodeStateToParam(state)}`
}

// Reads and strips a `?share=` payload sitting inside the hash route.
export function consumeSharedStateFromUrl() {
  const hash = window.location.hash
  const qIndex = hash.indexOf('?')
  if (qIndex === -1) return null

  const params = new URLSearchParams(hash.slice(qIndex + 1))
  const payload = params.get('share')
  if (!payload) return null

  const decoded = decodeStateFromParam(payload)

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
