import { initializeApp } from 'firebase/app'
import { doc, getDoc, getFirestore, onSnapshot, setDoc } from 'firebase/firestore'
import { FIREBASE_CONFIG } from './firebaseConfig'
import { decryptJson, encryptJson, importKey } from './crypto'
import { mergeStates } from './merge'

// Implements the same four methods as the local adapter, so nothing outside
// this file knows sync exists. Every payload is encrypted before it leaves the
// browser and decrypted after it arrives; Firestore only ever sees {iv, data}.

const WRITE_DEBOUNCE_MS = 800

export class FirestoreAdapter {
  constructor({ householdId, keyString, onLocalMerge }) {
    this.householdId = householdId
    this.keyString = keyString
    this.onLocalMerge = onLocalMerge
    this.key = null
    this.status = 'connecting'
    this.lastSeen = null
    this.pendingTimer = null
    this.pendingState = null

    const app = initializeApp(FIREBASE_CONFIG, `cc-hub-${householdId}`)
    this.db = getFirestore(app)
    this.ref = doc(this.db, 'households', householdId)
  }

  async ready() {
    if (!this.key) this.key = await importKey(this.keyString)
    return this.key
  }

  async load() {
    try {
      await this.ready()
      const snap = await getDoc(this.ref)
      if (!snap.exists()) {
        this.status = 'empty'
        return null
      }
      const state = await decryptJson(this.key, snap.data())
      this.status = 'synced'
      this.lastSeen = state
      return state
    } catch (err) {
      // A decryption failure means the key in the link doesn't match this
      // household — surfaced rather than silently falling back to empty, since
      // silently starting fresh would look like data loss.
      this.status = err?.name === 'OperationError' ? 'bad-key' : 'error'
      return null
    }
  }

  // Writes are debounced: dragging a valuation slider fires a state change per
  // frame, and each one would otherwise be a billable network round trip.
  async save(state) {
    this.pendingState = state
    if (this.pendingTimer) clearTimeout(this.pendingTimer)
    this.pendingTimer = setTimeout(() => this.flush(), WRITE_DEBOUNCE_MS)
  }

  async flush() {
    const state = this.pendingState
    if (!state) return
    this.pendingTimer = null
    try {
      await this.ready()
      const payload = await encryptJson(this.key, state)
      await setDoc(this.ref, { ...payload, updatedAt: Date.now(), v: 1 })
      this.lastSeen = state
      this.status = 'synced'
    } catch {
      this.status = 'error'
    }
  }

  subscribe(onChange) {
    let cancelled = false
    const unsub = onSnapshot(
      this.ref,
      async (snap) => {
        // Skip our own writes echoing back.
        if (!snap.exists() || snap.metadata.hasPendingWrites || cancelled) return
        try {
          await this.ready()
          const remote = await decryptJson(this.key, snap.data())
          if (!remote || cancelled) return
          this.status = 'synced'
          const merged = this.onLocalMerge ? this.onLocalMerge(remote) : remote
          this.lastSeen = merged
          onChange(merged)
        } catch {
          this.status = 'bad-key'
        }
      },
      () => {
        this.status = 'error'
      },
    )
    return () => {
      cancelled = true
      unsub()
    }
  }

  describe() {
    switch (this.status) {
      case 'synced':
        return { mode: 'cloud', detail: 'Synced & encrypted' }
      case 'bad-key':
        return { mode: 'error', detail: 'Sync key mismatch' }
      case 'error':
        return { mode: 'error', detail: 'Sync offline' }
      default:
        return { mode: 'cloud', detail: 'Connecting…' }
    }
  }
}

export { mergeStates }
