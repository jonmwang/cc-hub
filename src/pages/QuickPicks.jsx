import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store/StoreContext'
import { CATEGORY_BY_ID } from '../data/categories'
import { formatMultiplier, rankCardsForCategory } from '../lib/ranking'
import { creditPlanFor } from '../lib/credits'
import { CREDIT_MERCHANTS } from '../data/merchants'
import { currentQuarterLabel } from '../lib/periods'
import CardArt from '../components/CardArt'
import { Segmented, cardTitle, possessive } from '../components/ui'

// A flow chart, not a catalogue.
//
// Ordered by how often you actually reach for a card day to day, ending at the
// catch-all. Each step keeps its own line — bundling unrelated categories that
// happened to share a card ("Streaming, Rideshare & Transit") saved space but
// made the list harder to scan, which defeats the point of the page. The only
// grouping left is the terminal one, where categories with no real answer fold
// into "everything else" so the generic card appears once, at the bottom.
//
// Rideshare is deliberately absent. It has too many competing dependencies to
// answer in one line: the Reserve earns 5x, but Uber credits sit on the Amex
// cards and have to be spent on those to be captured at all. Both phones
// already have a default card set in the Uber app, so the question never comes
// up in practice.
//
// `short` is the label used if a step ever does get folded into another line.
const FLOW = [
  { categoryId: 'dining', label: 'Restaurants & takeout', short: 'Restaurants', icon: '🍽️' },
  { categoryId: 'groceries', label: 'Groceries', short: 'Groceries', icon: '🛒' },
  // `pin` keeps a step in place even when its answer is just the catch-all
  // card. Walmart and Target earn nothing special anywhere, but the whole point
  // of the line is warning you off the grocery card, so it sits right under it.
  { categoryId: 'superstores', label: 'Walmart & Target', short: 'Walmart & Target', icon: '🎯', pin: true },
  { categoryId: 'entertainment', label: 'Movies & live events', short: 'Movies', icon: '🎬' },
  { categoryId: 'transit', label: 'Subway, bus & train', short: 'Transit', icon: '🚇' },
  { categoryId: 'gas', label: 'Gas', short: 'Gas', icon: '⛽' },
  { categoryId: 'drugstores', label: 'Drugstores', short: 'Drugstores', icon: '💊' },
  { categoryId: 'flights_direct', label: 'Flights', short: 'Flights', icon: '✈️' },
  { categoryId: 'hotels_direct', label: 'Hotels', short: 'Hotels', icon: '🏨' },
  { categoryId: 'streaming', label: 'Streaming subscriptions', short: 'Streaming', icon: '📺' },
  { categoryId: 'online_retail', label: 'Online shopping', short: 'Online shopping', icon: '🛍️' },
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
            ? {
                id: `m-${rule.id}`,
                icon: '📍',
                image: rule.image,
                label: rule.name,
                note: rule.note,
                ranked,
                steps: [],
              }
            : null
        })
        .filter(Boolean),
    [state, scoped],
  )

  // Places where an unclaimed credit outranks the best earn rate. These sit up
  // top with the other exceptions, because getting them wrong costs real money
  // rather than a few points.
  const creditRows = useMemo(
    () =>
      CREDIT_MERCHANTS.map((m) => {
        const plan = creditPlanFor(state, m.id, scoped)
        if (!plan || !plan.hasAnyCredits) return null
        const winner = plan.unclaimed[0]
        const ranked = winner
          ? [{ ...plan.ranked.find((r) => r.key === winner.walletKey), key: winner.walletKey, card: winner.card, multiplier: winner.multiplier, ownerId: winner.ownerId }, ...plan.ranked]
          : plan.ranked
        if (!ranked[0]) return null
        return {
          id: `credit-${m.id}`,
          icon: m.icon,
          label: m.name,
          plan,
          ranked,
          steps: [],
        }
      }).filter(Boolean),
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

      rows.push({ id: step.categoryId, icon: step.icon, steps: [step], ranked })
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
  const allRows = [...merchantRows, ...creditRows, ...flowRows]

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
  const plan = row.plan
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
        <span className={`qp-icon ${row.image ? 'has-image' : ''}`} aria-hidden="true">
          {row.image ? <img src={row.image} alt="" loading="lazy" /> : row.icon}
        </span>

        <span className="qp-label">{title}</span>

        <CardArt card={card} width={74} showText={false} className="qp-thumb" />

        <span className="qp-answer">
          <span className="qp-card-name">{cardTitle(card)}</span>
          {plan?.unclaimed?.length > 0 && (
            <span className="chip chip-credit">
              {/* Must match the figure the expanded row states, so a pooled
                  credit is summed here too — a chip saying $15 above an
                  explanation saying $25 just looks broken. */}
              {(() => {
                const top = plan.unclaimed[0]
                const amount =
                  top.credit.redeemableBy === 'issuer'
                    ? plan.unclaimed
                        .filter((c) => c.credit.redeemableBy === 'issuer')
                        .reduce((sum, c) => sum + c.value, 0)
                    : top.value
                const who = ownerName(state, top.ownerId)
                return who
                  ? `${capitalise(possessive(who))} · $${amount} credit left`
                  : `$${amount} credit left`
              })()}
            </span>
          )}
          {plan?.allUsed && <span className="chip chip-cash">Credits used</span>}
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
                {row.image && <img className="qp-detail-logo" src={row.image} alt="" />}
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

              {plan && (
                <div className="qp-credit-plan">
                  {plan.unclaimed.length > 0 ? (
                    <>
                      <div className="qp-credit-why">
                        Pay with{' '}
                        <strong>
                          {ownerName(state, plan.unclaimed[0].ownerId)
                            ? `${possessive(ownerName(state, plan.unclaimed[0].ownerId))} ${cardTitle(plan.unclaimed[0].card)}`
                            : cardTitle(plan.unclaimed[0].card)}
                        </strong>{' '}
                        {/* "its" only holds when the card paying is the card the credit
                            came with. An issuer-redeemable credit — Amex Uber Cash — is a
                            balance any Amex redeems, so the honest phrasing is the pool
                            rather than one card's share of it. */}
                        {plan.unclaimed[0].credit.redeemableBy === 'issuer' ? 'to spend the' : 'to capture its'}{' '}
                        <strong>
                          $
                          {plan.unclaimed[0].credit.redeemableBy === 'issuer'
                            ? plan.unclaimed
                                .filter((c) => c.credit.redeemableBy === 'issuer')
                                .reduce((sum, c) => sum + c.value, 0)
                            : plan.unclaimed[0].value}
                        </strong>{' '}
                        {plan.merchant.name} credit
                        {plan.unclaimed[0].credit.redeemableBy === 'issuer'
                          ? ` sitting on your ${plan.unclaimed[0].card.issuer} cards`
                          : ''}
                        {plan.unclaimed[0].info?.useByLabel ? ` — use by ${plan.unclaimed[0].info.useByLabel}` : ''}.
                        A credit is real money; the earn-rate gap is pennies.
                      </div>
                      {/* Suppressed for a pooled credit: the total is already stated above,
                          and the runner-up is the same pot on a second card. */}
                      {plan.unclaimed.length > 1 && plan.unclaimed[0].credit.redeemableBy !== 'issuer' && (
                        <div className="qp-credit-more">
                          Then{' '}
                          <strong>
                            {ownerName(state, plan.unclaimed[1].ownerId)
                              ? `${possessive(ownerName(state, plan.unclaimed[1].ownerId))} ${cardTitle(plan.unclaimed[1].card)}`
                              : cardTitle(plan.unclaimed[1].card)}
                          </strong>{' '}
                          has ${plan.unclaimed[1].value} left too.
                        </div>
                      )}
                      {plan.earnWinner && plan.earnWinner.card.id !== plan.unclaimed[0].card.id && (
                        <div className="qp-credit-after">
                          Once the credits are gone this period, <strong>{cardTitle(plan.earnWinner.card)}</strong>{' '}
                          earns more ({formatMultiplier(plan.earnWinner.multiplier)} vs{' '}
                          {formatMultiplier(plan.unclaimed[0].multiplier)})
                          {plan.crossoverSpend
                            ? ` — and it already wins on a single order above about $${plan.crossoverSpend.toLocaleString()}.`
                            : '.'}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="qp-credit-why">
                      {plan.merchant.name} credits are all used for this period, so this is purely
                      about earn rate now.
                    </div>
                  )}
                </div>
              )}

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

// Both people can hold the same card, and a credit belongs to exactly one of
// them — so a credit answer that doesn't name the holder can send you to the
// wrong physical card.
const capitalise = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

function ownerName(state, ownerId) {
  if (state.people.length < 2) return null
  return state.people.find((p) => p.id === ownerId)?.name ?? null
}

// "Groceries" / "Flights & Hotels" / "Rideshare, Transit & Flights"
function joinLabels(steps, merged) {
  const names = steps.map((s) => (merged ? s.short : s.label))
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}
