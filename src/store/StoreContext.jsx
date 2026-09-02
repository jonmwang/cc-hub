import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CARD_BY_ID } from '../data/cards'
import { CURRENCIES } from '../data/currencies'
import {
  buildSyncUrl,
  consumeSharedStateFromUrl,
  consumeSyncLink,
  getAdapter,
  getSyncCreds,
  localAdapter,
  setAdapter,
  setSyncCreds,
} from '../lib/storage'
import { isConfigured } from '../lib/sync/firebaseConfig'
import { mergeStates } from '../lib/sync/merge'
import { generateKeyString, randomId } from '../lib/sync/crypto'
import { currentQuarterKey } from '../lib/periods'

const StoreContext = createContext(null)

export const walletKey = (cardId, ownerId) => `${cardId}__${ownerId}`

const DEFAULT_PEOPLE = [
  { id: 'me', name: 'Me', color: 'blue' },
  { id: 'partner', name: 'Partner', color: 'violet' },
]

// Seeded from the spreadsheet so the app is useful on first load. Everything
// here is editable and can be wiped from Settings before sharing with anyone.
const DEFAULT_WALLET = [
  ...[
    'chase_freedom_flex',
    'chase_freedom_unlimited',
    'chase_sapphire_preferred',
    'chase_sapphire_reserve',
    'amex_gold',
    'amex_platinum',
    'c1_venture_x',
    'wf_autograph',
  ].map((cardId) => ({ key: walletKey(cardId, 'me'), cardId, ownerId: 'me', openDate: null })),
  ...['chase_sapphire_preferred', 'c1_savor', 'c1_venture_x', 'discover_it'].map((cardId) => ({
    key: walletKey(cardId, 'partner'),
    cardId,
    ownerId: 'partner',
    openDate: null,
  })),
]

// Named places whose merchant coding doesn't match what you'd expect. Each rule
// pins a category and knocks out the cards that don't actually earn the bonus
// there, so Quick Picks can answer the store rather than the category.
const DEFAULT_MERCHANT_RULES = [
  {
    id: 'joymart',
    name: 'Joymart',
    categoryId: 'groceries',
    excludedCardIds: ['amex_gold'],
    note: 'Does not code as groceries or dining on the Amex Gold.',
    // Logos live in public/logos/, produced by scripts/prep_card_images.py.
    // A real storefront logo is recognised far faster than any emoji.
    image: 'logos/joymart.webp',
  },
]

function defaultState() {
  return {
    version: 1,
    people: DEFAULT_PEOPLE,
    wallet: DEFAULT_WALLET,
    valuations: Object.fromEntries(Object.values(CURRENCIES).map((c) => [c.id, c.defaultCpp])),
    settings: {
      valuationMode: 'points', // 'points' | 'cashback_ok'
      hideCashbackOnly: false,
      ownerFilter: 'all', // 'all' | personId
      quickPicksOwner: 'all', // whose wallet the simple Quick Picks page shows
    },
    rotating: {}, // walletKey -> { quarterKey, categories: [] }
    merchantRules: DEFAULT_MERCHANT_RULES,
    creditValues: {}, // walletKey -> creditId -> number
    creditsUsed: {}, // walletKey -> creditId -> { periodKey, usedAt }
    // Append-only record of every credit actually claimed. `creditsUsed` only
    // ever holds the CURRENT window, so without this there is no way to answer
    // "how much have I clawed back this year" — a monthly credit used in March
    // is invisible by April.
    creditsLog: [], // { key, creditId, periodKey, usedAt, value }
  }
}

// Old saves keep working when the catalog gains fields.
function migrate(saved) {
  const base = defaultState()
  if (!saved || typeof saved !== 'object') return base
  return {
    ...base,
    ...saved,
    people: saved.people?.length ? saved.people : base.people,
    wallet: (saved.wallet ?? base.wallet).filter((w) => CARD_BY_ID[w.cardId]),
    valuations: { ...base.valuations, ...(saved.valuations ?? {}) },
    settings: { ...base.settings, ...(saved.settings ?? {}) },
    rotating: saved.rotating ?? {},
    merchantRules: saved.merchantRules ?? base.merchantRules,
    creditValues: saved.creditValues ?? {},
    creditsUsed: saved.creditsUsed ?? {},
    creditsLog: saved.creditsLog ?? [],
  }
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(null)
  const [sharedNotice, setSharedNotice] = useState(false)
  const [syncCreds, setCreds] = useState(() => consumeSyncLink() ?? getSyncCreds())
  const [adapter, setLocalAdapter] = useState(() => getAdapter())
  const hydrated = useRef(false)
  // The adapter merges remote changes against whatever is on screen right now,
  // so a snapshot arriving mid-edit can't wipe out an unsaved local change.
  const stateRef = useRef(null)
  stateRef.current = state

  // Swap in the encrypted cloud adapter when the household is set up. Nothing
  // outside this effect knows which one is in play.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!syncCreds || !isConfigured()) {
        const local = localAdapter()
        setAdapter(local)
        if (!cancelled) setLocalAdapter(local)
        return
      }
      const { FirestoreAdapter } = await import('../lib/sync/firebaseAdapter')
      if (cancelled) return
      const remote = new FirestoreAdapter({
        ...syncCreds,
        onLocalMerge: (incoming) => mergeStates(stateRef.current, incoming),
      })
      setAdapter(remote)
      setLocalAdapter(remote)
      hydrated.current = false
    })()
    return () => {
      cancelled = true
    }
  }, [syncCreds])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const shared = await consumeSharedStateFromUrl()
      const stored = await adapter.load()
      if (cancelled) return
      if (shared) {
        setState(migrate(shared))
        setSharedNotice(true)
      } else if (stored) {
        setState(migrate(stored))
      } else if (stateRef.current) {
        // First device into an empty household: keep what's already on screen
        // and let the save effect seed the remote copy with it.
        setState(stateRef.current)
      } else {
        // Nothing in the cloud yet and nothing on screen — fall back to whatever
        // this browser had locally so switching on sync never looks like a wipe.
        setState(migrate(await localAdapter().load()))
      }
      hydrated.current = true
    })()
    return () => {
      cancelled = true
    }
  }, [adapter])

  // Persist on every change, but never write back the empty pre-hydration state.
  useEffect(() => {
    if (!state || !hydrated.current) return
    adapter.save(state)
    // Always keep a local copy too. If the household link is ever lost, the
    // encrypted remote copy is unrecoverable, but this browser still has it.
    if (syncCreds) localAdapter().save(state)
  }, [state, adapter, syncCreds])

  useEffect(() => adapter.subscribe((next) => setState(migrate(next))), [adapter])

  // Pasting a share link while the app is already open only changes the hash —
  // no reload, so the startup path above never sees it and the link silently
  // does nothing. Catch it here too, which is the common case when someone
  // sends an updated link to a partner who already has the site open.
  useEffect(() => {
    const onHashChange = async () => {
      if (!window.location.hash.includes('s=') && !window.location.hash.includes('share=')) return
      const shared = await consumeSharedStateFromUrl()
      if (!shared) return
      setState(migrate(shared))
      setSharedNotice(true)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const update = useCallback((fn) => setState((s) => (s ? fn(s) : s)), [])

  const actions = useMemo(
    () => ({
      addCard: (cardId, ownerId) =>
        update((s) => {
          const key = walletKey(cardId, ownerId)
          if (s.wallet.some((w) => w.key === key)) return s
          return { ...s, wallet: [...s.wallet, { key, cardId, ownerId, openDate: null }] }
        }),

      removeCard: (key) =>
        update((s) => ({ ...s, wallet: s.wallet.filter((w) => w.key !== key) })),

      setOpenDate: (key, openDate) =>
        update((s) => ({
          ...s,
          wallet: s.wallet.map((w) => (w.key === key ? { ...w, openDate } : w)),
        })),

      setValuation: (currencyId, cpp) =>
        update((s) => ({ ...s, valuations: { ...s.valuations, [currencyId]: cpp } })),

      resetValuations: () =>
        update((s) => ({
          ...s,
          valuations: Object.fromEntries(Object.values(CURRENCIES).map((c) => [c.id, c.defaultCpp])),
        })),

      setSetting: (patch) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } })),

      renamePerson: (id, name) =>
        update((s) => ({ ...s, people: s.people.map((p) => (p.id === id ? { ...p, name } : p)) })),

      // Rotating categories are scoped to a wallet entry and stamped with the
      // quarter, so stale picks disappear on their own.
      setRotatingCategories: (key, categories) =>
        update((s) => ({
          ...s,
          rotating: { ...s.rotating, [key]: { quarterKey: currentQuarterKey(), categories } },
        })),

      addMerchantRule: (rule) =>
        update((s) => ({
          ...s,
          merchantRules: [
            ...s.merchantRules,
            { id: `m_${Date.now().toString(36)}`, excludedCardIds: [], note: '', ...rule },
          ],
        })),

      updateMerchantRule: (id, patch) =>
        update((s) => ({
          ...s,
          merchantRules: s.merchantRules.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),

      removeMerchantRule: (id) =>
        update((s) => ({ ...s, merchantRules: s.merchantRules.filter((m) => m.id !== id) })),

      setCreditValue: (key, creditId, value) =>
        update((s) => ({
          ...s,
          creditValues: {
            ...s.creditValues,
            [key]: { ...(s.creditValues[key] ?? {}), [creditId]: value },
          },
        })),

      resetCreditValues: (key) =>
        update((s) => {
          const next = { ...s.creditValues }
          delete next[key]
          return { ...s, creditValues: next }
        }),

      toggleCreditUsed: (key, creditId, periodKey, currentlyUsed, value = 0, face = value) =>
        update((s) => {
          const forCard = { ...(s.creditsUsed[key] ?? {}) }
          const sameEntry = (e) => e.key === key && e.creditId === creditId && e.periodKey === periodKey

          if (currentlyUsed) {
            delete forCard[creditId]
            // Un-ticking is a correction, so drop the matching log entry too —
            // otherwise the running total would keep counting a credit you
            // decided you never actually claimed.
            return {
              ...s,
              creditsUsed: { ...s.creditsUsed, [key]: forCard },
              creditsLog: s.creditsLog.filter((e) => !sameEntry(e)),
            }
          }

          const usedAt = new Date().toISOString()
          forCard[creditId] = { periodKey, usedAt }
          return {
            ...s,
            creditsUsed: { ...s.creditsUsed, [key]: forCard },
            creditsLog: [
              ...s.creditsLog.filter((e) => !sameEntry(e)),
              // Both figures are kept: `face` is what the issuer credited (and
              // what reconciles against a statement), `value` is what it was
              // worth to you.
              { key, creditId, periodKey, usedAt, value, face },
            ],
          }
        }),

      replaceState: (next) => setState(migrate(next)),

      // Creates a household: a random id for the Firestore document and a
      // random AES key that never leaves the browser. Returns the invite link.
      enableSync: async () => {
        const creds = { householdId: randomId(16), keyString: await generateKeyString() }
        setSyncCreds(creds)
        setCreds(creds)
        return buildSyncUrl(creds)
      },

      disableSync: () => {
        setSyncCreds(null)
        setCreds(null)
      },

      resetAll: () => setState(defaultState()),

      clearWallet: () =>
        update((s) => ({ ...s, wallet: [], rotating: {}, creditValues: {}, creditsUsed: {}, creditsLog: [] })),
    }),
    [update],
  )

  const value = useMemo(
    () => ({
      state,
      actions,
      adapter,
      syncCreds,
      syncConfigured: isConfigured(),
      syncUrl: syncCreds ? buildSyncUrl(syncCreds) : null,
      sharedNotice,
      dismissSharedNotice: () => setSharedNotice(false),
    }),
    [state, actions, adapter, syncCreds, sharedNotice],
  )

  if (!state) return null

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
