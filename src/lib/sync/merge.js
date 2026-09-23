// Merging two versions of the state.
//
// With two people editing, the naive approach — last write wins on the whole
// document — can silently drop a credit somebody just ticked off. That is the
// worst failure this app can have, because you'd never notice: the checkbox
// just quietly isn't ticked any more, and you'd assume you forgot.
//
// So the usage log gets special treatment. It is append-only and each entry is
// uniquely identified by (wallet key, credit id, period key), which makes it
// safe to union rather than overwrite. Un-ticking writes a tombstone
// (`removedAt`) instead of deleting the entry, because a deletion and a claim
// the other device simply hasn't seen yet are indistinguishable — and guessing
// wrong means erasing a real claim.
//
// Everything else is genuinely last-write-wins, which is fine for settings and
// valuations: a conflict there needs both people changing the same slider
// within a second of each other, and the loss is a preference, not a record.

const logId = (e) => `${e.key}|${e.creditId}|${e.periodKey}`

// When the entry was last decided on — claimed, or un-claimed.
const decidedAt = (e) => new Date(e.removedAt ?? e.usedAt).getTime()

export const isLiveClaim = (e) => Boolean(e) && !e.removedAt

/**
 * @param mine   the local state
 * @param theirs the state that just arrived from the server
 * @param opts.preferTheirs  true when the remote copy is newer
 */
export function mergeStates(mine, theirs, { preferTheirs = true } = {}) {
  if (!theirs) return mine
  if (!mine) return theirs

  const base = preferTheirs ? { ...mine, ...theirs } : { ...theirs, ...mine }

  const byId = new Map()
  for (const entry of [...(mine.creditsLog ?? []), ...(theirs.creditsLog ?? [])]) {
    if (!entry?.key || !entry?.creditId) continue
    const id = logId(entry)
    const existing = byId.get(id)
    if (!existing) {
      byId.set(id, entry)
      continue
    }
    // A tombstone and a claim are a real disagreement: the most recent decision
    // is the one that stands. Two plain claims are the same event recorded
    // twice, so keep the earlier one — that's when the credit was really used.
    if (existing.removedAt || entry.removedAt) {
      if (decidedAt(entry) > decidedAt(existing)) byId.set(id, entry)
    } else if (new Date(entry.usedAt) < new Date(existing.usedAt)) {
      byId.set(id, entry)
    }
  }
  const creditsLog = [...byId.values()].sort((a, b) => new Date(a.usedAt) - new Date(b.usedAt))

  // creditsUsed describes only the window that is current right now, and the
  // log is the authority on what was claimed. Rebuilding it from the union is
  // what stops a stale copy from erasing a tick made on the other device.
  const creditsUsed = {}
  for (const e of byId.values()) {
    if (!isLiveClaim(e)) continue
    if (!creditsUsed[e.key]) creditsUsed[e.key] = {}
    creditsUsed[e.key][e.creditId] = { periodKey: e.periodKey, usedAt: e.usedAt }
  }

  return { ...base, creditsLog, creditsUsed, wallet: mergeWallet(mine, theirs, base) }
}

/**
 * Wallet membership is last-write-wins (so removing a card actually removes it),
 * but an open date is not: it is typed in once, on one device, and every other
 * copy has null there. Plain last-write-wins let any save from a device that
 * hadn't seen the date wipe it — and with it, every anniversary credit window
 * on that card.
 */
function mergeWallet(mine, theirs, base) {
  const dates = new Map()
  for (const entry of [...(mine.wallet ?? []), ...(theirs.wallet ?? [])]) {
    if (entry?.key && entry.openDate && !dates.has(entry.key)) dates.set(entry.key, entry.openDate)
  }
  return (base.wallet ?? []).map((entry) =>
    entry.openDate ? entry : { ...entry, openDate: dates.get(entry.key) ?? entry.openDate },
  )
}
