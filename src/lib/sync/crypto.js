// End-to-end encryption for synced state.
//
// The whole point: the sync server stores ciphertext and nothing else. Google
// hosts the bytes but cannot read them, and neither can anyone who reaches the
// database by any route.
//
// The key never touches a server. It travels inside the URL *fragment* of the
// invite link (`#/...`), and browsers never transmit the fragment — not in the
// request line, not in Referer. So the link can pass through a messaging app to
// your partner's browser without the key ever being sent anywhere.
//
// The consequence, stated plainly: lose every copy of the link and the data is
// unrecoverable. Nobody can decrypt it, including us. JSON backups from the
// Settings page are the safety net.

const KEY_BYTES = 32 // AES-256
const IV_BYTES = 12 // GCM standard

export function toBase64Url(bytes) {
  let binary = ''
  new Uint8Array(bytes).forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

export function randomId(bytes = 16) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)))
}

/** A fresh AES-256-GCM key, exported as a base64url string for the invite link. */
export async function generateKeyString() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(KEY_BYTES)))
}

export async function importKey(keyString) {
  const raw = fromBase64Url(keyString)
  if (raw.length !== KEY_BYTES) throw new Error('bad key length')
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

/**
 * Encrypts a JS value. A fresh random IV per write — reusing an IV with the
 * same key breaks GCM badly, so it is never derived or cached.
 */
export async function encryptJson(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const plaintext = new TextEncoder().encode(JSON.stringify(value))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return { iv: toBase64Url(iv), data: toBase64Url(cipher) }
}

export async function decryptJson(key, payload) {
  if (!payload?.iv || !payload?.data) return null
  const iv = fromBase64Url(payload.iv)
  const cipher = fromBase64Url(payload.data)
  // GCM authenticates as well as encrypts: a wrong key or tampered bytes throw
  // here rather than silently returning garbage.
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return JSON.parse(new TextDecoder().decode(plain))
}
