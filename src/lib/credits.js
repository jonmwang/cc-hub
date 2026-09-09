import { CARD_BY_ID } from '../data/cards'
import { CREDIT_MERCHANT_BY_ID } from '../data/merchants'
import { getPeriodInfo } from './periods'
import { cppFor, effectiveMultiplier, rankCardsForCategory, visibleWallet } from './ranking'

// Whether a credit has already been claimed in the window that is current now.
//
// `creditsUsed` only ever describes the present window, which is what makes the
// reset automatic — but a closed window (a past semiannual half) can be ticked
// retroactively, and that only lives in the log.
export function isCreditUsed(state, walletKey, creditId, info) {
  if (info.status === 'closed') {
    return state.creditsLog.some(
      (e) => e.key === walletKey && e.creditId === creditId && e.periodKey === info.key,
    )
  }
  const rec = state.creditsUsed[walletKey]?.[creditId]
  if (!rec) return false
  if (info.key === 'every4years') return info.status !== 'available'
  return rec.periodKey === info.key
}

/**
 * The card to reach for at a credit-linked merchant, and when to stop.
 *
 * Returns the unclaimed credits available right now (largest first), the best
 * pure earner for the underlying category, and the spend above which earning
 * actually beats claiming.
 */
export function creditPlanFor(state, merchantId, opts = {}) {
  const merchant = CREDIT_MERCHANT_BY_ID[merchantId]
  if (!merchant) return null

  const now = opts.now ?? new Date()
  const wallet = visibleWallet(state, opts)

  const claims = []
  for (const entry of wallet) {
    const card = CARD_BY_ID[entry.cardId]
    if (!card) continue
    for (const credit of card.credits) {
      if (credit.merchant !== merchantId) continue
      const info = getPeriodInfo(credit, entry.openDate, state.creditsUsed[entry.key]?.[credit.id]?.usedAt, now)
      if (!info.active) continue
      const used = isCreditUsed(state, entry.key, credit.id, info)
      const value = state.creditValues[entry.key]?.[credit.id] ?? credit.value
      const { multiplier } = effectiveMultiplier(state, entry, merchant.categoryId)
      claims.push({
        walletKey: entry.key,
        ownerId: entry.ownerId,
        card,
        credit,
        value,
        used,
        info,
        multiplier,
        cpp: cppFor(state, card),
      })
    }
  }

  // Biggest unclaimed credit first — you can only put one card on a
  // transaction, so take the largest bite available.
  const unclaimed = claims.filter((c) => !c.used).sort((a, b) => b.value - a.value)
  const claimed = claims.filter((c) => c.used)

  const ranked = rankCardsForCategory(state, merchant.categoryId, opts)
  const earnWinner = ranked[0] ?? null

  // Where claiming stops being the better move:
  //   credit + spend·Ma·cpp  >  spend·Mb·cpp
  //   spend < credit / ((Mb − Ma)·cpp)
  // If the credit card also earns at least as much, there is no crossover —
  // it simply always wins.
  let crossoverSpend = null
  const top = unclaimed[0]
  if (top && earnWinner) {
    const gap = earnWinner.value - top.multiplier * top.cpp // cents per dollar
    if (gap > 0) crossoverSpend = Math.round((top.value * 100) / gap)
  }

  return {
    merchant,
    unclaimed,
    claimed,
    allUsed: claims.length > 0 && unclaimed.length === 0,
    hasAnyCredits: claims.length > 0,
    earnWinner,
    ranked,
    crossoverSpend,
  }
}
