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
    let openValue = 0
    let urgent = 0
    for (const w of entries) {
      const card = CARD_BY_ID[w.cardId]
      for (const c of card.credits) {
        const info = getPeriodInfo(c, w.openDate, state.creditsUsed[w.key]?.[c.id]?.usedAt, now)
        if (!info.active) continue
        const used = isUsed(state, w.key, c.id, info)
        if (used) continue
        open += 1
        openValue += state.creditValues[w.key]?.[c.id] ?? c.value
        if (urgencyFor(info) === 'critical') urgent += 1
      }
    }
    return { open, openValue, urgent }
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
          <div className="stat-value">{summary.open}</div>
          <div className="stat-label">Credits still open</div>
        </div>
        <div className="stat">
          <div className="stat-value">{money(summary.openValue)}</div>
          <div className="stat-label">Left on the table</div>
        </div>
        <div className="stat">
          <div className="stat-value" style={{ color: summary.urgent ? 'var(--red)' : 'var(--green)' }}>
            {summary.urgent}
          </div>
          <div className="stat-label">Expiring soon</div>
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

function TrackerCard({ entry, person, state, actions, now, hideDone }) {
  const card = CARD_BY_ID[entry.cardId]
  const needsOpenDate = card.credits.some((c) => c.period === 'anniversary') && !entry.openDate

  const rows = card.credits.map((c) => {
    const info = getPeriodInfo(c, entry.openDate, state.creditsUsed[entry.key]?.[c.id]?.usedAt, now)
    return { credit: c, info, used: isUsed(state, entry.key, c.id, info) }
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
        const value = state.creditValues[entry.key]?.[credit.id] ?? credit.value
        const urgency = urgencyFor(info)
        const disabled = !info.active

        return (
          <div
            className={`credit-item ${used ? 'used' : ''} ${disabled ? 'inactive' : ''}`}
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
            </div>

            <div className="ci-amount">{money(value)}</div>

            <button
              className={`use-btn ${used ? 'done' : urgency}`}
              disabled={disabled}
              onClick={() => actions.toggleCreditUsed(entry.key, credit.id, info.key, used, value)}
            >
              {used ? '✓ Used' : disabled ? 'Unavailable' : 'Mark used'}
            </button>
          </div>
        )
      })}
    </section>
  )
}
