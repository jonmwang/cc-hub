import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store/StoreContext'
import { CATEGORY_BY_ID } from '../data/categories'
import { formatMultiplier, rankCardsForCategory } from '../lib/ranking'
import { currentQuarterLabel } from '../lib/periods'
import CardArt from '../components/CardArt'
import { Segmented, cardTitle } from '../components/ui'

// A flow chart, not a catalogue.
//
// Ordered by how often you actually reach for a card — food and groceries at
// the top, the catch-all at the bottom — rather than by category type. Adjacent
// steps that resolve to the same card collapse into one line, so the list
// funnels the way a real flow chart does and the generic card lands last.
//
// Walmart & Target sit directly under Groceries because they're the exception
// that grocery bonuses carve out.
//
// `short` is the label used when a step gets merged with its neighbours.
const FLOW = [
  { categoryId: 'groceries', label: 'Groceries', short: 'Groceries', icon: '🛒' },
  // `pin` keeps a step in place even when its answer is just the catch-all
  // card. Walmart and Target earn nothing special anywhere, but the whole point
  // of the line is warning you off the grocery card, so it has to stay put.
  { categoryId: 'superstores', label: 'Walmart & Target', short: 'Walmart & Target', icon: '🎯', pin: true },
  { categoryId: 'dining', label: 'Restaurants & takeout', short: 'Restaurants', icon: '🍽️' },
  { categoryId: 'drugstores', label: 'Drugstores', short: 'Drugstores', icon: '💊' },
  { categoryId: 'gas', label: 'Gas', short: 'Gas', icon: '⛽' },
  { categoryId: 'entertainment', label: 'Movies & live events', short: 'Movies', icon: '🎬' },
  { categoryId: 'streaming', label: 'Streaming subscriptions', short: 'Streaming', icon: '📺' },
  { categoryId: 'online_retail', label: 'Online shopping', short: 'Online shopping', icon: '🛍️' },
  { categoryId: 'rideshare', label: 'Uber & Lyft', short: 'Rideshare', icon: '🚕' },
  { categoryId: 'transit', label: 'Subway, bus & train', short: 'Transit', icon: '🚇' },
  { categoryId: 'flights_direct', label: 'Flights', short: 'Flights', icon: '✈️' },
  { categoryId: 'hotels_direct', label: 'Hotels', short: 'Hotels', icon: '🏨' },
  { categoryId: 'wholesale', label: 'Costco & warehouse clubs', short: 'Costco', icon: '🏬' },
  { categoryId: 'everything_else', label: 'Everything else', short: 'everything else', icon: '💳' },
]

export default function QuickPicks() {
  const { state, actions } = useStore()
  const [openId, setOpenId] = useState(null)
  const owner = state.settings.quickPicksOwner ?? 'all'

  const scoped = useMemo(() => ({ ownerFilter: owner, ignoreCashbackFilter: true }), [owner])

  const merchantRows = useMemo(
    () =>
      state.merchantRules
        .map((rule) => {
          const ranked = rankCardsForCategory(state, rule.categoryId, {
            ...scoped,
            excludeCardIds: rule.excludedCardIds,
          })
          return ranked[0]
            ? { id: `m-${rule.id}`, icon: '📍', label: rule.name, note: rule.note, ranked, steps: [] }
            : null
        })
        .filter(Boolean),
    [state, scoped],
  )

  const flowRows = useMemo(() => {
    const catchAllRanked = rankCardsForCategory(state, 'everything_else', scoped)
    const catchAll = catchAllRanked[0]
    if (!catchAll) return []

    const rows = []
    const deferred = [] // steps with no better answer than the catch-all card

    for (const step of FLOW) {
      if (step.categoryId === 'everything_else') continue

      const ranked = rankCardsForCategory(state, step.categoryId, scoped)
      const winner = ranked[0]
      if (!winner) continue

      // A step that lands on the catch-all card at the catch-all rate isn't a
      // real branch — it's the default wearing a category name. Push it to the
      // bottom so the flow only ever narrows, and the generic card lands last.
      const isJustTheDefault =
        winner.key === catchAll.key && winner.multiplier === catchAll.multiplier && !winner.isRotating
      if (isJustTheDefault && !step.pin) {
        deferred.push(step)
        continue
      }

      const prev = rows[rows.length - 1]
      if (prev && prev.ranked[0].key === winner.key && prev.ranked[0].isRotating === winner.isRotating) {
        prev.steps.push(step)
      } else {
        rows.push({ id: step.categoryId, icon: step.icon, steps: [step], ranked })
      }
    }

    const everythingElse = FLOW[FLOW.length - 1]
    rows.push({
      id: 'everything_else',
      icon: everythingElse.icon,
      steps: [...deferred, everythingElse],
      ranked: catchAllRanked,
    })

    return rows
  }, [state, scoped])

  const hasCards = state.wallet.some((w) => owner === 'all' || w.ownerId === owner)
  const allRows = [...merchantRows, ...flowRows]

  return (
    <div className="page qp-page">
      <div className="qp-head">
        <div className="eyebrow">Updated for {currentQuarterLabel()}</div>
        <h1>What card should I use?</h1>
        <p>Work down the list. Stop at the first line that matches.</p>

        {state.people.length > 1 && (
          <div className="qp-owner">
            <Segmented
              ariaLabel="Whose cards to show"
              value={owner}
              onChange={(v) => actions.setSetting({ quickPicksOwner: v })}
              options={[
                { value: 'all', label: 'All our cards' },
                ...state.people.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </div>
        )}
      </div>

      {!hasCards ? (
        <div className="empty">
          <strong>No cards to show</strong>
          Pick a different person above, or add cards in Settings.
        </div>
      ) : (
        <div className="qp-flow">
          {allRows.map((row, i) => (
            <FlowRow
              key={row.id}
              row={row}
              index={i}
              last={i === allRows.length - 1}
              open={openId === row.id}
              onToggle={() => setOpenId(openId === row.id ? null : row.id)}
              state={state}
            />
          ))}
        </div>
      )}

      <p className="qp-foot">
        Tap any line for the details. Quarterly categories and store exceptions are set on the{' '}
        <strong>Which Card?</strong> page and show up here right away.
      </p>
    </div>
  )
}

function FlowRow({ row, index, last, open, onToggle, state }) {
  const winner = row.ranked[0]
  const card = winner.card
  const merged = row.steps.length > 1

  const title = row.label ?? joinLabels(row.steps, merged)
  const backup = card.issuer === 'Amex' ? row.ranked.find((r) => r.card.issuer !== 'Amex') : null
  const person = state.people.find((p) => p.id === winner.ownerId)

  // Both people can hold the same card, which would otherwise list it twice.
  const runnersUp = []
  const seen = new Set([card.id])
  for (const r of row.ranked.slice(1)) {
    if (seen.has(r.card.id)) continue
    seen.add(r.card.id)
    runnersUp.push(r)
    if (runnersUp.length === 3) break
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.3), ease: [0.22, 1, 0.36, 1] }}
      className={`qp-step ${open ? 'open' : ''} ${row.note ? 'special' : ''} ${last ? 'terminal' : ''}`}
    >
      <button className="qp-trigger" onClick={onToggle} aria-expanded={open}>
        <span className="qp-icon" aria-hidden="true">
          {row.icon}
        </span>

        <span className="qp-label">{title}</span>

        <CardArt card={card} width={74} showText={false} className="qp-thumb" />

        <span className="qp-answer">
          <span className="qp-card-name">{cardTitle(card)}</span>
          {winner.isRotating && <span className="chip chip-rotating">This quarter</span>}
        </span>

        <span className="qp-chevron" aria-hidden="true" data-open={open}>
          ⌄
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="qp-details-wrap"
          >
            <div className="qp-details">
              <div className="qp-detail-hero">
                <CardArt card={card} width={132} />
                <div>
                  <div className="qp-detail-name">{cardTitle(card)}</div>
                  <div className="qp-detail-rate">
                    {formatMultiplier(winner.multiplier)}
                    {person ? ` · ${person.name}` : ''}
                  </div>
                  {row.note && <p className="qp-detail-note">{row.note}</p>}
                </div>
              </div>

              {row.steps.length > 0 && (
                <dl className="qp-covers">
                  {row.steps.map((s) => (
                    <div key={s.categoryId}>
                      <dt>{s.label}</dt>
                      <dd>{CATEGORY_BY_ID[s.categoryId]?.hint}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {backup && (
                <div className="qp-fallback">
                  <strong>If they don't take Amex</strong>
                  <span>
                    {cardTitle(backup.card)} · {formatMultiplier(backup.multiplier)}
                  </span>
                </div>
              )}

              {runnersUp.length > 0 && (
                <div className="qp-runners">
                  <span className="qp-runners-label">Next best</span>
                  {runnersUp.map((r) => (
                    <span className="qp-runner" key={r.key}>
                      {cardTitle(r.card)}
                      <em>{formatMultiplier(r.multiplier)}</em>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// "Groceries" / "Flights & Hotels" / "Rideshare, Transit & Flights"
function joinLabels(steps, merged) {
  const names = steps.map((s) => (merged ? s.short : s.label))
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}
