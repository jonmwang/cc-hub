import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store/StoreContext'
import { CATEGORY_BY_ID } from '../data/categories'
import { rankCardsForCategory } from '../lib/ranking'
import { currentQuarterLabel } from '../lib/periods'
import { Segmented, cardTitle } from '../components/ui'

// A read-only page. Everything on it is derived from the wallet, the point
// values, and the quarterly categories set on the Which Card? page — change
// those there and this page follows automatically.
//
// Ordered by how often you actually reach for a card, not alphabetically.
const SCENARIOS = [
  { categoryId: 'groceries', label: 'Groceries', icon: '🛒' },
  { categoryId: 'dining', label: 'Restaurants, takeout & delivery', icon: '🍽️' },
  { categoryId: 'entertainment', label: 'Movies & live events', icon: '🎬' },
  { categoryId: 'gas', label: 'Gas', icon: '⛽' },
  { categoryId: 'transit', label: 'Subway, bus & train', icon: '🚇' },
  { categoryId: 'rideshare', label: 'Uber & Lyft', icon: '🚕' },
  { categoryId: 'drugstores', label: 'Drugstores', icon: '💊' },
  { categoryId: 'streaming', label: 'Streaming subscriptions', icon: '📺' },
  { categoryId: 'online_retail', label: 'Online shopping', icon: '🛍️' },
  { categoryId: 'flights_direct', label: 'Flights', icon: '✈️' },
  { categoryId: 'hotels_direct', label: 'Hotels', icon: '🏨' },
  { categoryId: 'wholesale', label: 'Costco & warehouse clubs', icon: '🏬' },
  { categoryId: 'everything_else', label: 'Everything else', icon: '💳' },
]

export default function QuickPicks() {
  const { state, actions } = useStore()
  const owner = state.settings.quickPicksOwner ?? 'all'

  const scoped = useMemo(
    () => ({ ownerFilter: owner, ignoreCashbackFilter: true }),
    [owner],
  )

  const merchantPicks = useMemo(
    () =>
      state.merchantRules.map((rule) => {
        const ranked = rankCardsForCategory(state, rule.categoryId, {
          ...scoped,
          excludeCardIds: rule.excludedCardIds,
        })
        return { rule, winner: ranked[0] }
      }),
    [state, scoped],
  )

  const picks = useMemo(
    () =>
      SCENARIOS.map((s) => {
        const ranked = rankCardsForCategory(state, s.categoryId, scoped)
        const winner = ranked[0]
        // If the best card is an Amex, she needs a backup for the many places
        // that don't take it.
        const amexBackup =
          winner?.card.issuer === 'Amex'
            ? ranked.find((r) => r.card.issuer !== 'Amex')
            : null
        return { ...s, winner, amexBackup }
      }),
    [state, scoped],
  )

  const hasCards = state.wallet.some((w) => owner === 'all' || w.ownerId === owner)

  return (
    <div className="page qp-page">
      <div className="qp-head">
        <div className="eyebrow">Updated for {currentQuarterLabel()}</div>
        <h1>What card should I use?</h1>
        <p>Find what you're buying, tap nothing, use the card it names.</p>

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
        <>
          {merchantPicks.length > 0 && (
            <div className="qp-section">
              <h2 className="qp-section-title">Special cases</h2>
              {merchantPicks.map(({ rule, winner }, i) =>
                winner ? (
                  <PickRow
                    key={rule.id}
                    index={i}
                    icon="📍"
                    label={rule.name}
                    sub={rule.note}
                    winner={winner}
                    special
                  />
                ) : null,
              )}
            </div>
          )}

          <div className="qp-section">
            <h2 className="qp-section-title">Everyday</h2>
            {picks.map((p, i) =>
              p.winner ? (
                <PickRow
                  key={p.categoryId}
                  index={i + merchantPicks.length}
                  icon={p.icon}
                  label={p.label}
                  sub={CATEGORY_BY_ID[p.categoryId]?.hint}
                  winner={p.winner}
                  backup={p.amexBackup}
                />
              ) : null,
            )}
          </div>
        </>
      )}

      <p className="qp-foot">
        Rates come from the cards themselves. Quarterly bonus categories are set on the{' '}
        <strong>Which Card?</strong> page and show up here the moment they change.
      </p>
    </div>
  )
}

function PickRow({ index, icon, label, sub, winner, backup, special }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.025, 0.25), ease: [0.22, 1, 0.36, 1] }}
      className={`qp-row ${special ? 'special' : ''}`}
    >
      <div className="qp-what">
        <span className="qp-icon" aria-hidden="true">
          {icon}
        </span>
        <div className="qp-what-text">
          <div className="qp-label">{label}</div>
          {sub && <div className="qp-sub">{sub}</div>}
        </div>
      </div>

      <div className="qp-arrow" aria-hidden="true">
        →
      </div>

      <div className="qp-answer">
        <div className="qp-card-name">
          {cardTitle(winner.card)}
        </div>
        <div className="qp-badges">
          {winner.isRotating && <span className="chip chip-rotating">This quarter only</span>}
          {backup && (
            <span className="qp-backup">
              No Amex? Use <strong>{backup.card.name}</strong>
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
