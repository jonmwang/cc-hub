import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store/StoreContext'
import { CARD_BY_ID } from '../data/cards'
import { CATEGORY_BY_ID } from '../data/categories'
import { CURRENCIES } from '../data/currencies'
import { activeRotatingCategories, formatMultiplier, isCashbackOnly } from '../lib/ranking'
import { currentQuarterLabel, occurrencesPerYear } from '../lib/periods'
import { OwnerChip, Segmented, cardNameOnly, money } from '../components/ui'

export default function Home() {
  const { state } = useStore()
  const [owner, setOwner] = useState('all')

  const people = state.people
  const personById = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people])

  const shown = state.wallet.filter((w) => owner === 'all' || w.ownerId === owner)

  const stats = useMemo(() => {
    const totalFees = state.wallet.reduce((sum, w) => sum + (CARD_BY_ID[w.cardId]?.annualFee ?? 0), 0)
    const totalCredits = state.wallet.reduce((sum, w) => {
      const card = CARD_BY_ID[w.cardId]
      if (!card) return sum
      return (
        sum +
        card.credits.reduce((s, c) => {
          const v = state.creditValues[w.key]?.[c.id] ?? c.value
          return s + v * occurrencesPerYear(c.period)
        }, 0)
      )
    }, 0)
    return { totalFees, totalCredits, count: state.wallet.length }
  }, [state.wallet, state.creditValues])

  return (
    <div className="page page-wide">
      <div className="hero">
        <div className="eyebrow">{currentQuarterLabel()}</div>
        <h1>Your household card lineup</h1>
        <p>
          Every card you and your partner carry, with the earn rates that actually matter. Head to{' '}
          <Link to="/which-card">Which Card?</Link> when you are standing at a register, or the{' '}
          <Link to="/credits">Credit Tracker</Link> to see what is expiring soon.
        </p>
        <div className="hero-stats">
          <div className="stat">
            <div className="stat-value">{stats.count}</div>
            <div className="stat-label">Cards tracked</div>
          </div>
          <div className="stat">
            <div className="stat-value">{money(stats.totalFees)}</div>
            <div className="stat-label">Annual fees</div>
          </div>
          <div className="stat">
            <div className="stat-value">{money(stats.totalCredits)}</div>
            <div className="stat-label">Credits at face value</div>
          </div>
          <div className="stat">
            <div className="stat-value" style={{ color: stats.totalCredits >= stats.totalFees ? 'var(--green)' : 'var(--red)' }}>
              {stats.totalCredits >= stats.totalFees ? '+' : '−'}
              {money(Math.abs(stats.totalCredits - stats.totalFees))}
            </div>
            <div className="stat-label">Face-value net</div>
          </div>
        </div>
      </div>

      <div className="section-head">
        <div>
          <h2>Cards & multipliers</h2>
          <div className="sub">Colour-coded by who holds the card.</div>
        </div>
        <div style={{ minWidth: 260 }}>
          <Segmented
            ariaLabel="Filter by cardholder"
            value={owner}
            onChange={setOwner}
            options={[{ value: 'all', label: 'Everyone' }, ...people.map((p) => ({ value: p.id, label: p.name }))]}
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <strong>No cards here yet</strong>
          Add cards from <Link to="/settings">Settings & Sharing</Link>.
        </div>
      ) : (
        <div className="card-grid">
          {shown.map((w, i) => (
            <WalletCard key={w.key} entry={w} person={personById[w.ownerId]} index={i} state={state} />
          ))}
        </div>
      )}
    </div>
  )
}

function WalletCard({ entry, person, index, state }) {
  const card = CARD_BY_ID[entry.cardId]
  const rotating = activeRotatingCategories(state, entry.key)
  const bonus = card.anniversaryBonus ?? 0

  // Bonus categories, best first; the catch-all rate is shown separately.
  const rates = Object.entries(card.earn)
    .map(([catId, mult]) => ({ catId, mult: mult + bonus, label: CATEGORY_BY_ID[catId]?.label ?? catId }))
    .sort((a, b) => b.mult - a.mult)

  const ownerClass = person?.color === 'violet' ? 'owner-partner' : 'owner-me'

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.035, 0.3), ease: [0.22, 1, 0.36, 1] }}
      className={`wallet-card ${ownerClass}`}
    >
      <div className="stripe" />
      <div className="wc-head">
        <div className="wc-issuer">{card.issuer}</div>
        <div className="wc-name">{cardNameOnly(card)}</div>
        <div className="wc-meta">
          <OwnerChip person={person} />
          <span className="chip">{CURRENCIES[card.currency].short}</span>
          {card.rotating && <span className="chip chip-rotating">Rotating 5%</span>}
          {isCashbackOnly(card) && <span className="chip chip-cash">Cash back</span>}
        </div>
      </div>

      <div className="wc-rates">
        {rotating.length > 0 && (
          <div className="rate-row">
            <span className="rate-mult" style={{ color: 'var(--amber)' }}>5x</span>
            <span className="rate-label" style={{ color: 'var(--amber)', fontWeight: 600 }}>
              {rotating.map((c) => CATEGORY_BY_ID[c]?.label ?? c).join(', ')}
              <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · this quarter</span>
            </span>
          </div>
        )}

        {rates.map((r) => (
          <div className="rate-row" key={r.catId}>
            <span className="rate-mult">{formatMultiplier(r.mult)}</span>
            <span className="rate-label">{r.label}</span>
          </div>
        ))}

        <div className="rate-row is-base">
          <span className="rate-mult">{formatMultiplier(card.base + bonus)}</span>
          <span className="rate-label">Everything else</span>
        </div>

        {card.anniversaryBonusNote && <p className="notes-list" style={{ listStyle: 'none', paddingLeft: 0 }}>{card.anniversaryBonusNote}</p>}

        {card.notes?.length > 0 && (
          <ul className="notes-list">
            {card.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="wc-foot">
        <span>
          Annual fee{' '}
          <span className={`wc-fee ${card.annualFee === 0 ? 'free' : ''}`}>
            {card.annualFee === 0 ? 'None' : money(card.annualFee)}
          </span>
        </span>
        {card.credits.length > 0 && <span>{card.credits.length} credits</span>}
      </div>
    </motion.article>
  )
}
