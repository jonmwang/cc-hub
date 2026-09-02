import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store/StoreContext'
import { CARD_BY_ID } from '../data/cards'
import { getPeriodInfo, urgencyFor } from '../lib/periods'
import CardArt from '../components/CardArt'
import { OwnerChip, Segmented, cardTitle, money } from '../components/ui'

export default function CreditTracker() {
  const { state, actions } = useStore()
  const [owner, setOwner] = useState('all')
  const [hideDone, setHideDone] = useState(false)

  const now = useMemo(() => new Date(), [])
  const people = useMemo(() => Object.fromEntries(state.people.map((p) => [p.id, p])), [state.people])

  const entries = state.wallet
    .filter((w) => owner === 'all' || w.ownerId === owner)
    .filter((w) => (CARD_BY_ID[w.cardId]?.credits.length ?? 0) > 0)

  const summary = useMemo(() => {
    let open = 0
    let openFace = 0
    let urgent = 0
    for (const w of entries) {
      const card = CARD_BY_ID[w.cardId]
      for (const c of card.credits) {
        const info = getPeriodInfo(c, w.openDate, state.creditsUsed[w.key]?.[c.id]?.usedAt, now)
        if (!info.active) continue
        if (isUsed(state, w.key, c.id, info)) continue
        open += 1
        openFace += c.value
        if (urgencyFor(info) === 'critical') urgent += 1
      }
    }

    // Two running totals for the year, because they answer different questions:
    // face value is what the issuer says you claimed (and what matches your
    // statements), personal value is what it was actually worth to you.
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime()
    const ownerKeys = new Set(entries.map((w) => w.key))
    let redeemedFace = 0
    let redeemedWorth = 0
    for (const e of state.creditsLog) {
      if (!ownerKeys.has(e.key)) continue
      if (new Date(e.usedAt).getTime() < yearStart) continue
      redeemedFace += e.face ?? e.value ?? 0
      redeemedWorth += e.value ?? 0
    }

    return { open, openFace, urgent, redeemedFace, redeemedWorth }
  }, [entries, state, now])

  return (
    <div className="page page-wide">
      <div className="page-head">
        <h1>Credit tracker</h1>
        <p>
          Mark a credit the moment you use it. Each one resets on its own schedule — monthly, quarterly,
          per half-year, or on the card's anniversary — so nothing needs clearing by hand.
        </p>
        <p className="hint" style={{ maxWidth: '68ch' }}>
          Every credit shows a <strong>use by</strong> date that sits a few days before the window
          actually shuts — 3 days for monthly credits, 5 for quarterly, 7 for longer ones. Spending on
          the true last day often fails to post in time (Amex's monthly dining credit is the usual
          culprit), so that date is the one worth treating as the deadline. <strong>Expiring soon</strong>{' '}
          counts anything already past its use-by date or close to it.
        </p>
      </div>

      <div className="hero-stats" style={{ marginBottom: 24, marginTop: 0 }}>
        <div className="stat">
          <div className="stat-value">{money(summary.redeemedFace)}</div>
          <div className="stat-label">Redeemed at face value</div>
          <div className="stat-sub">{new Date().getFullYear()} · matches your statements</div>
        </div>
        <div className="stat">
          <div className="stat-value">{money(summary.redeemedWorth)}</div>
          <div className="stat-label">Worth to you</div>
          <div className="stat-sub">Same credits, your own valuations</div>
        </div>
        <div className="stat">
          <div className="stat-value">{money(summary.openFace)}</div>
          <div className="stat-label">Left on the table</div>
          <div className="stat-sub">{summary.open} credits still open</div>
        </div>
        <div className="stat">
          <div className="stat-value" style={{ color: summary.urgent ? 'var(--red)' : 'var(--green)' }}>
            {summary.urgent}
          </div>
          <div className="stat-label">Expiring soon</div>
          <div className="stat-sub">Past the use-by date, or near it</div>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 0 }}>
        <div style={{ minWidth: 250 }}>
          <Segmented
            ariaLabel="Filter by cardholder"
            value={owner}
            onChange={setOwner}
            options={[{ value: 'all', label: 'Everyone' }, ...state.people.map((p) => ({ value: p.id, label: p.name }))]}
          />
        </div>
        <button className="btn btn-sm" onClick={() => setHideDone((v) => !v)}>
          {hideDone ? 'Show used credits' : 'Hide used credits'}
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="empty">
          <strong>No credit-bearing cards</strong>
          Cards without recurring credits are not shown here.
        </div>
      ) : (
        entries.map((w) => (
          <TrackerCard
            key={w.key}
            entry={w}
            person={people[w.ownerId]}
            state={state}
            actions={actions}
            now={now}
            hideDone={hideDone}
          />
        ))
      )}
    </div>
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtShort = (d) => (d ? `${MONTHS[d.getMonth()]} ${d.getDate()}` : '')

// A credit counts as used only if it was checked off inside the window that is
// current right now — that is what makes the reset automatic.
function isUsed(state, key, creditId, info) {
  const rec = state.creditsUsed[key]?.[creditId]
  if (!rec) return false
  if (info.key === 'every4years') return info.status !== 'available'
  return rec.periodKey === info.key
}

// Closed windows (a past semiannual half) can be ticked retroactively, so their
// used-state has to be read from the log rather than from `creditsUsed`, which
// only ever describes the window that is current right now.
function wasUsedInClosedWindow(state, key, creditId, info) {
  return state.creditsLog.some((e) => e.key === key && e.creditId === creditId && e.periodKey === info.key)
}

function TrackerCard({ entry, person, state, actions, now, hideDone }) {
  const [confirmId, setConfirmId] = useState(null)
  const card = CARD_BY_ID[entry.cardId]
  const needsOpenDate = card.credits.some((c) => c.period === 'anniversary') && !entry.openDate

  const rows = card.credits.map((c) => {
    const info = getPeriodInfo(c, entry.openDate, state.creditsUsed[entry.key]?.[c.id]?.usedAt, now)
    const used =
      info.status === 'closed'
        ? wasUsedInClosedWindow(state, entry.key, c.id, info)
        : isUsed(state, entry.key, c.id, info)
    return { credit: c, info, used }
  })

  const activeRows = rows.filter((r) => r.info.active)
  const doneCount = activeRows.filter((r) => r.used).length
  const pct = activeRows.length ? (doneCount / activeRows.length) * 100 : 0

  const visible = hideDone ? rows.filter((r) => !r.used) : rows

  return (
    <section className="tracker-card">
      <div className="tracker-head">
        <CardArt card={card} width={56} showText={false} />
        <div className="tracker-title">
          <span className={`owner-dot ${person?.color === 'violet' ? 'partner' : 'me'}`} />
          {cardTitle(card)}
        </div>
        <OwnerChip person={person} />
        <div className="tracker-progress">
          <span>
            {doneCount}/{activeRows.length} used
          </span>
          <div className="bar">
            <motion.div
              className="bar-fill"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      </div>

      {needsOpenDate && (
        <div className="date-prompt">
          <span>
            This card has anniversary-based credits. Add the date you opened it so they reset on the right
            day.
          </span>
          <input
            type="date"
            value={entry.openDate ?? ''}
            onChange={(e) => actions.setOpenDate(entry.key, e.target.value || null)}
            aria-label={`${card.name} open date`}
          />
        </div>
      )}

      {visible.map(({ credit, info, used }) => {
        const worth = state.creditValues[entry.key]?.[credit.id] ?? credit.value
        const urgency = urgencyFor(info)
        // A shut window can still be ticked off — you may well have used the
        // credit before this app existed — but only after confirming, so it
        // can't happen by a stray click.
        const closed = info.status === 'closed'
        const disabled = !info.active && !closed
        const confirming = confirmId === credit.id
        const mark = () => actions.toggleCreditUsed(entry.key, credit.id, info.key, used, worth, credit.value)

        return (
          <div
            className={`credit-item ${used ? 'used' : ''} ${disabled ? 'inactive' : ''} ${confirming ? 'confirming' : ''}`}
            key={credit.id}
          >
            <div className="ci-main">
              <div className="ci-name">{credit.label}</div>
              <div className="ci-meta">
                <span>{info.label}</span>
                {info.window && info.window !== '—' && <span>· {info.window}</span>}
                {info.active && !used && info.useByLabel && (
                  <span className={`ci-useby ${urgency}`}>
                    {info.inDangerZone
                      ? `· spend today may not post — window shuts ${fmtShort(info.end)}`
                      : `· use by ${info.useByLabel} · ${info.daysToUse} ${info.daysToUse === 1 ? 'day' : 'days'}`}
                  </span>
                )}
                {info.status === 'upcoming' && <span className="chip">Opens later this year</span>}
                {info.status === 'closed' && <span className="chip">Window closed</span>}
                {info.status === 'needs-date' && <span className="chip chip-rotating">Add open date</span>}
              </div>

              {confirming && (
                <div className="ci-confirm">
                  <strong>This window closed on {fmtShort(info.end)}.</strong> Only mark it used if you
                  actually claimed it before then — it counts toward this year's totals either way.
                  <div className="ci-confirm-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => { mark(); setConfirmId(null) }}>
                      Yes, I used it
                    </button>
                    <button className="btn btn-sm" onClick={() => setConfirmId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Face value is what the issuer advertises and what shows on a
                statement, so it leads. Your own valuation sits underneath only
                when the two differ. */}
            <div className="ci-amount">
              {money(credit.value)}
              {worth !== credit.value && <span className="ci-worth">{money(worth)} to you</span>}
            </div>

            <button
              className={`use-btn ${used ? 'done' : closed ? 'closed' : urgency}`}
              disabled={disabled}
              onClick={() => {
                if (closed && !used) setConfirmId(confirming ? null : credit.id)
                else mark()
              }}
            >
              {used ? '✓ Used' : disabled ? 'Unavailable' : closed ? 'Mark used anyway' : 'Mark used'}
            </button>
          </div>
        )
      })}
    </section>
  )
}
