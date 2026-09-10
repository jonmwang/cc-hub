import { CARD_BY_ID } from '../data/cards'
import { CURRENCIES } from '../data/currencies'
import { currentQuarterKey } from './periods'

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
    // The quarterly bonus is added ON TOP of whatever the card already earns,
    // it does not replace it. On a plain 1x category that gives the advertised
    // 5% (1 + 4). But where the card already pays a standing bonus — dining and
    // drugstores on the Freedom Flex, both 3x — the bonus stacks to 7x. Easy to
    // model wrong as a flat 5x, and it costs you two points per dollar.
    multiplier = standing + (card.rotatingBonus ?? 4)
    isRotating = true
  }

  return { multiplier: multiplier + anniversaryBonusFor(card), isRotating }
}

// Some perks have an announced end date. Returning 0 past it means every rate
// in the app corrects itself on the day, with no edit needed.
export function anniversaryBonusFor(card, now = new Date()) {
  if (!card.anniversaryBonus) return 0
  if (card.anniversaryBonusEndsOn && now >= new Date(`${card.anniversaryBonusEndsOn}T00:00:00`)) return 0
  return card.anniversaryBonus
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
    // Genuine tie: prefer the more premium card. Annual fee is a decent proxy —
    // premium cards carry higher credit lines, so they're the better card to put
    // a big restaurant tab on even when the earn rate is identical.
    if (b.card.annualFee !== a.card.annualFee) return b.card.annualFee - a.card.annualFee
    return a.card.name.localeCompare(b.card.name)
  })

  return rows
}

/**
 * The person to name when telling someone which physical card to reach for.
 *
 * Only worth saying when exactly ONE person in the household holds that card.
 * Both of you carry a Venture X and a Sapphire Preferred, so labelling those is
 * noise — either card works. But "Amex Gold" is one physical card in one
 * person's wallet, and a household that pools cards needs to know whose.
 *
 * Returns null when the label would add nothing.
 */
export function soleHolderName(state, cardId) {
  if (!state.people || state.people.length < 2) return null
  const holders = [...new Set(state.wallet.filter((w) => w.cardId === cardId).map((w) => w.ownerId))]
  if (holders.length !== 1) return null
  return state.people.find((p) => p.id === holders[0])?.name ?? null
}

export const formatMultiplier = (m) =>
  Number.isInteger(m) ? `${m}x` : `${m.toFixed(1).replace(/\.0$/, '')}x`

export const formatValue = (v) => `${v.toFixed(2)}¢`
