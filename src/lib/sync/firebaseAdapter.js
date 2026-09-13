import { initializeApp } from 'firebase/app'
import { doc, getDoc, getFirestore, onSnapshot, setDoc } from 'firebase/firestore'
import { FIREBASE_CONFIG } from './firebaseConfig'
import { decryptJson, encryptJson, importKey } from './crypto'
import { mergeStates } from './merge'

// Implements the same four methods as the local adapter, so nothing outside
// this file knows sync exists. Every payload is encrypted before it leaves the
// browser and decrypted after it arrives; Firestore only ever sees {iv, data}.

const WRITE_DEBOUNCE_MS = 800

// Key-order-independent serialisation, used only to answer "is this the same
// state I already sent?". mergeStates and migrate rebuild objects, so plain
// JSON.stringify can differ byte-for-byte while describing identical data —
// which is exactly the case that has to compare equal here.
const stableJson = (value) =>
  JSON.stringify(value, (_key, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.keys(val)
          .sort()
          .reduce((out, k) => {
            out[k] = val[k]
            return out
          }, {})
      : val,
  )

// The part of an answer sheet that carries meaning. The header comment includes a
// generation timestamp, so the raw text differs on every build even when not one
// answer has changed — comparing whole files would rewrite all three sheets on
// every save.
const sheetBody = (tsv) =>
  String(tsv)
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .join('\n')

const decodeBase64Utf8 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))

export class FirestoreAdapter {
  constructor({ householdId, keyString, onLocalMerge, buildAnswers }) {
    this.householdId = householdId
    this.keyString = keyString
    this.onLocalMerge = onLocalMerge
    // Optional: produces the small plaintext answer sheet the Siri shortcut
    // reads. Kept separate from the encrypted document on purpose — see
    // publishAnswers below for exactly what it does and does not contain.
    this.buildAnswers = buildAnswers
    this.key = null
    this.status = 'connecting'
    this.lastSeen = null
    // Serialisation of the last payload actually sent. The write loop guard —
    // see flush().
    this.lastSentJson = null
    // Body of each answer sheet as the server holds it, by document path. Filled
    // lazily on first publish — see publishSheet().
    this.publishedBodies = new Map()
    this.pendingTimer = null
    this.pendingState = null

    const app = initializeApp(FIREBASE_CONFIG, `cc-hub-${householdId}`)
    this.db = getFirestore(app)
    this.ref = doc(this.db, 'households', householdId)
    this.answersRef = doc(this.db, 'answers', householdId)
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
      this.lastSentJson = stableJson(state)
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

    // Don't write state we already sent.
    //
    // Without this the app writes in an unbounded loop, and it is not obvious
    // from any one piece of code. A server snapshot arrives with
    // hasPendingWrites false — that flag only suppresses the optimistic local
    // echo, not the confirmed one — subscribe() merges it into a *new* object,
    // React sees a changed reference, the persist effect fires, and we write.
    // That write confirms, which delivers another snapshot, and round it goes at
    // roughly one write per debounce interval.
    //
    // It burned 20,000 writes in a night: the entire Spark daily quota. Firestore
    // then rejected every write, flush() swallowed it, and the answer sheet
    // silently stopped updating while reads carried on working perfectly — which
    // is a genuinely hard thing to diagnose from the outside.
    //
    // `lastSeen` was clearly meant to be this guard; it was assigned in three
    // places and never once compared.
    const json = stableJson(state)
    if (json === this.lastSentJson) {
      this.status = 'synced'
      // Still offer the sheets. The state can be unchanged while the *generator*
      // has changed — a deploy that rewords an answer is exactly that — and with
      // the guard above, merely opening the app no longer writes anything, so
      // this is the only path by which a new release reaches the sheet.
      // publishSheet() writes nothing unless an answer actually differs.
      await this.publishAnswers(state)
      return
    }

    try {
      await this.ready()
      const payload = await encryptJson(this.key, state)
      await setDoc(this.ref, { ...payload, updatedAt: Date.now(), v: 1 })
      this.lastSeen = state
      this.lastSentJson = json
      this.status = 'synced'
      await this.publishAnswers(state)
    } catch (err) {
      // Quota exhaustion earns its own status. "Sync offline" sent us looking at
      // security rules, payload sizes, deploy pipelines and browser caches for
      // hours; the database was simply refusing writes for the rest of the day.
      this.status = err?.code === 'resource-exhausted' ? 'quota' : 'error'
      this.lastError = err?.code || err?.message || 'unknown'
    }
  }

  /**
   * Publishes the spoken answer sheet in PLAINTEXT, so a Siri shortcut can read
   * it with nothing but curl and awk.
   *
   * This is a deliberate, scoped exception to the end-to-end encryption. Stock
   * macOS cannot decrypt AES-GCM — LibreSSL lists the cipher but fails at
   * runtime, and /usr/bin/python3 has no crypto module — so a shell script
   * physically cannot read the encrypted document.
   *
   * What goes in: thirteen lines of "category -> card name", e.g.
   * "movies -> Capital One Savor". Enough to answer out loud, nothing more.
   *
   * What stays encrypted: point valuations, annual fees, credit values, the
   * entire usage log and history, household names, and card open dates.
   *
   * Stored base64-encoded so the shell script can pull it out of the REST JSON
   * with sed and decode it with the stock base64 tool, without tripping over
   * escaped newlines and tabs.
   */
  // One publish at a time. A slow network can let two debounced flushes overlap,
  // and two interleaved publishes would both see "not yet published" and write.
  publishAnswers(state) {
    this.publishQueue = (this.publishQueue ?? Promise.resolve()).then(() => this.publishAnswersNow(state))
    return this.publishQueue
  }

  async publishAnswersNow(state) {
    if (!this.buildAnswers) return
    try {
      const encode = (tsv) => {
        const bytes = new TextEncoder().encode(tsv)
        let binary = ''
        bytes.forEach((b) => {
          binary += String.fromCharCode(b)
        })
        return btoa(binary)
      }

      // The household sheet: whatever the site's own person selector is set to.
      const tsv = this.buildAnswers(state)
      if (!tsv) return
      await this.publishSheet(this.answersRef, tsv, encode)

      // Plus one sheet per person, scoped to only the cards they actually hold.
      //
      // Without these there is a single household sheet naming the best card in
      // the HOUSE — which for a two-person wallet means roughly half the answers
      // point at somebody else's card. Handing that to a partner produces
      // confident wrong answers aimed at the person least able to catch them,
      // which is the one failure this whole tool exists to prevent.
      for (const person of state.people ?? []) {
        const personTsv = this.buildAnswers(state, { ownerFilter: person.id })
        if (!personTsv) continue
        await this.publishSheet(doc(this.db, 'answers', `${this.householdId}_${person.id}`), personTsv, encode)
      }
    } catch (err) {
      // Never let the answer sheet take sync down with it — the encrypted
      // document is the source of truth and has already been written. But record
      // it: a silently stale sheet looks right and is trusted, which is worse
      // than one that is visibly broken.
      this.answersError = err?.code || err?.message || 'unknown'
    }
  }

  // Write one answer sheet, but only if an answer on it changed.
  //
  // Most saves change nothing a reader would hear: dragging a valuation, ticking
  // a credit whose card doesn't top any list. Rewriting all three sheets on each
  // one made every save cost four writes instead of one.
  //
  // The first time a sheet is published this session, read what the server
  // already has. That is what makes simply opening the app free, while a release
  // that changed the generator still gets published on first open. Three reads
  // per session, against a daily budget of 50,000.
  async publishSheet(ref, tsv, encode) {
    if (!tsv) return
    const body = sheetBody(tsv)
    if (!this.publishedBodies.has(ref.path)) {
      try {
        const snap = await getDoc(ref)
        const b64 = snap.exists() ? snap.data()?.b64 : null
        this.publishedBodies.set(ref.path, b64 ? sheetBody(decodeBase64Utf8(b64)) : null)
      } catch {
        this.publishedBodies.set(ref.path, null)
      }
    }
    if (this.publishedBodies.get(ref.path) === body) return
    await setDoc(ref, { b64: encode(tsv), updatedAt: Date.now(), v: 1 })
    this.publishedBodies.set(ref.path, body)
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
          // Another device changed the household, and it will usually have
          // republished the sheets too. Forget what we believed the server holds
          // so publishSheet() re-reads before deciding — otherwise every open
          // device rewrites all three sheets after every answer-changing edit,
          // from a cache that went stale the moment the other device wrote.
          // Three reads instead of three redundant writes. (Our own writes never
          // reach here: they arrive with hasPendingWrites and return above.)
          this.publishedBodies.clear()
          const merged = this.onLocalMerge ? this.onLocalMerge(remote) : remote
          // If merging contributed nothing of ours, the server already holds
          // exactly this state, so there is nothing to send back. Without this,
          // every change made on one device was written a second time by each
          // other open device the moment it arrived — half of all sync writes in
          // a two-person household, for no information at all.
          const remoteJson = stableJson(remote)
          if (stableJson(merged) === remoteJson) this.lastSentJson = remoteJson
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
      case 'quota':
        return { mode: 'error', detail: 'Daily write limit reached — sync resumes tomorrow' }
      case 'error':
        return { mode: 'error', detail: 'Sync offline' }
      default:
        return { mode: 'cloud', detail: 'Connecting…' }
    }
  }
}

export { mergeStates }
