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
 * The best card of one issuer to put on this purchase.
 *
 * Exists for a single real-world quirk. Almost every credit here only posts if
 * that exact card pays — the Reserve's DoorDash promos, the Platinum's hotel
 * credit. Amex Uber Cash does not work that way: it is deposited into the Uber
 * account and redeems against *any* Amex, so the credit constrains the issuer
 * and nothing more. The card to reach for is then whichever Amex earns most,
 * which is not the card the credit arrived with — the Platinum carries the
 * bigger $15 balance but earns 1x on dining, while the Gold earns 4x and
 * redeems the same pool.
 */
function bestEntryForIssuer(state, wallet, issuer, categoryId) {
  let best = null
  let bestValue = -1
  for (const entry of wallet) {
    const card = CARD_BY_ID[entry.cardId]
    if (!card || card.issuer !== issuer) continue
    const { multiplier } = effectiveMultiplier(state, entry, categoryId)
    const value = multiplier * cppFor(state, card)
    if (value > bestValue) {
      bestValue = value
      best = entry
    }
  }
  return best
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
      // Sibling merchants can share one pot — Uber and Uber Eats both spend the
      // same Uber Cash — so match the pool, falling back to the merchant's own
      // id for the credits it owns outright.
      if (credit.merchant !== (merchant.creditPool ?? merchantId)) continue
      const info = getPeriodInfo(credit, entry.openDate, state.creditsUsed[entry.key]?.[credit.id]?.usedAt, now)
      if (!info.active) continue
      const used = isCreditUsed(state, entry.key, credit.id, info)
      const value = state.creditValues[entry.key]?.[credit.id] ?? credit.value

      // Which card actually goes on the transaction. Normally the card holding
      // the credit, because that is the only way it posts. A credit marked
      // `redeemableBy: 'issuer'` is the exception: any card from that issuer
      // redeems it, so reach for whichever of them earns most.
      const payEntry =
        (credit.redeemableBy === 'issuer'
          ? bestEntryForIssuer(state, wallet, card.issuer, merchant.categoryId)
          : null) ?? entry
      const payCard = CARD_BY_ID[payEntry.cardId] ?? card
      const { multiplier } = effectiveMultiplier(state, payEntry, merchant.categoryId)

      claims.push({
        // Usage stays keyed to the card that carries the credit, whatever card
        // ends up paying — otherwise ticking it off would mark the wrong line
        // in the Credit Tracker and it would never reset.
        walletKey: entry.key,
        ownerId: payEntry.ownerId,
        card: payCard,
        credit,
        value,
        used,
        info,
        multiplier,
        cpp: cppFor(state, payCard),
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
