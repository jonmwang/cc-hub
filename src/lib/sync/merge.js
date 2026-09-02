// Merging two versions of the state.
//
// With two people editing, the naive approach — last write wins on the whole
// document — can silently drop a credit somebody just ticked off. That is the
// worst failure this app can have, because you'd never notice: the checkbox
// just quietly isn't ticked any more, and you'd assume you forgot.
//
// So the usage log gets special treatment. It is append-only and each entry is
// uniquely identified by (wallet key, credit id, period key), which makes it
// safe to union rather than overwrite. Everything else is genuinely
// last-write-wins, which is fine for settings and valuations: a conflict there
// needs both people changing the same slider within a second of each other,
// and the loss is a preference, not a record.

const logId = (e) => `${e.key}|${e.creditId}|${e.periodKey}`

/**
 * @param mine   the local state
 * @param theirs the state that just arrived from the server
 * @param opts.preferTheirs  true when the remote copy is newer
 */
export function mergeStates(mine, theirs, { preferTheirs = true } = {}) {
  if (!theirs) return mine
  if (!mine) return theirs

  const base = preferTheirs ? { ...mine, ...theirs } : { ...theirs, ...mine }

  // Union the log by identity, keeping the earliest claim if both sides have
  // the same one — that's the moment the credit was actually used.
  const byId = new Map()
  for (const entry of [...(mine.creditsLog ?? []), ...(theirs.creditsLog ?? [])]) {
    if (!entry?.key || !entry?.creditId) continue
    const id = logId(entry)
    const existing = byId.get(id)
    if (!existing || new Date(entry.usedAt) < new Date(existing.usedAt)) byId.set(id, entry)
  }
  const creditsLog = [...byId.values()].sort((a, b) => new Date(a.usedAt) - new Date(b.usedAt))

  // creditsUsed describes only the window that is current right now, and the
  // log is the authority on what was claimed. Rebuild it from the union so a
  // tick made on one device can't be erased by a stale copy from the other.
  const creditsUsed = {}
  for (const [, e] of byId) {
    if (!creditsUsed[e.key]) creditsUsed[e.key] = {}
    creditsUsed[e.key][e.creditId] = { periodKey: e.periodKey, usedAt: e.usedAt }
  }

  // A credit un-ticked locally has no log entry, so the rebuild above would
  // resurrect it from the remote copy. Honour explicit local removals.
  for (const [walletKey, credits] of Object.entries(mine.creditsUsed ?? {})) {
    for (const creditId of Object.keys(creditsUsed[walletKey] ?? {})) {
      const stillHeldLocally = credits[creditId]
      const inLocalLog = (mine.creditsLog ?? []).some(
        (e) => e.key === walletKey && e.creditId === creditId,
      )
      if (!stillHeldLocally && !inLocalLog) delete creditsUsed[walletKey][creditId]
    }
  }

  return { ...base, creditsLog, creditsUsed }
}
