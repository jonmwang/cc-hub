import { CARD_BY_ID } from '../data/cards'
import { CURRENCIES } from '../data/currencies'
import { currentQuarterKey } from './periods'

const ROTATING_RATE = 5

// Rotating picks only count for the quarter they were entered in — an
// un-refreshed quarter silently falls back to the card's standing rates rather
// than quietly recommending last quarter's categories.
export function activeRotatingCategories(state, key) {
  const entry = state.rotating[key]
  if (!entry) return []
  if (entry.quarterKey !== currentQuarterKey()) return []
  return entry.categories ?? []
}

export function effectiveMultiplier(state, walletEntry, categoryId) {
  const card = CARD_BY_ID[walletEntry.cardId]
  if (!card) return { multiplier: 0, isRotating: false }

  const standing = card.earn[categoryId] ?? card.base
  let multiplier = standing
  let isRotating = false

  if (card.rotating && activeRotatingCategories(state, walletEntry.key).includes(categoryId)) {
    // The quarterly rate replaces the standing rate rather than stacking on it.
    if (ROTATING_RATE > standing) {
      multiplier = ROTATING_RATE
      isRotating = true
    }
  }

  return { multiplier: multiplier + (card.anniversaryBonus ?? 0), isRotating }
}

export function cppFor(state, card) {
  if (state.settings.valuationMode === 'cashback_ok') return 1
  const currency = CURRENCIES[card.currency]
  if (currency?.locked) return 1
  return state.valuations[card.currency] ?? currency?.defaultCpp ?? 1
}

export function isCashbackOnly(card) {
  return CURRENCIES[card.currency]?.transferable === false
}

export function visibleWallet(state, opts = {}) {
  const ownerFilter = opts.ownerFilter ?? state.settings.ownerFilter
  const exclude = opts.excludeCardIds ?? []
  return state.wallet.filter((w) => {
    const card = CARD_BY_ID[w.cardId]
    if (!card) return false
    if (ownerFilter !== 'all' && w.ownerId !== ownerFilter) return false
    if (!opts.ignoreCashbackFilter && state.settings.hideCashbackOnly && isCashbackOnly(card)) return false
    if (exclude.includes(w.cardId)) return false
    return true
  })
}

/**
 * Ranks the visible wallet for one spend category, best first.
 * `value` is cents earned per dollar spent — the number the ordering is on.
 *
 * `opts.excludeCardIds` drops cards that don't actually earn their bonus at a
 * given merchant; `opts.ownerFilter` scopes the ranking to one person's wallet.
 */
export function rankCardsForCategory(state, categoryId, opts = {}) {
  const rows = visibleWallet(state, opts).map((w) => {
    const card = CARD_BY_ID[w.cardId]
    const { multiplier, isRotating } = effectiveMultiplier(state, w, categoryId)
    const cpp = cppFor(state, card)
    return {
      key: w.key,
      walletEntry: w,
      card,
      ownerId: w.ownerId,
      multiplier,
      isRotating,
      cpp,
      value: multiplier * cpp,
      cashbackOnly: isCashbackOnly(card),
    }
  })

  rows.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value
    if (b.multiplier !== a.multiplier) return b.multiplier - a.multiplier
    return a.card.name.localeCompare(b.card.name)
  })

  return rows
}

export const formatMultiplier = (m) =>
  Number.isInteger(m) ? `${m}x` : `${m.toFixed(1).replace(/\.0$/, '')}x`

export const formatValue = (v) => `${v.toFixed(2)}¢`
