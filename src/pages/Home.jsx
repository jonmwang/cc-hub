import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store/StoreContext'
import { CARD_BY_ID } from '../data/cards'
import { occurrencesPerYear, currentQuarterLabel } from '../lib/periods'
import { getPeriodInfo, urgencyFor } from '../lib/periods'
import CardArt from '../components/CardArt'
import { money } from '../components/ui'

// A landing page, not a dashboard. One headline number set, one obvious button,
// and the wallet as a picture. Everything detailed lives one click away.
export default function Home() {
  const { state } = useStore()
  const now = useMemo(() => new Date(), [])

  const summary = useMemo(() => {
    let fees = 0
    let credits = 0
    let expiringSoon = 0

    for (const w of state.wallet) {
      const card = CARD_BY_ID[w.cardId]
      if (!card) continue
      fees += card.annualFee
      for (const c of card.credits) {
        const value = state.creditValues[w.key]?.[c.id] ?? c.value
        credits += value * occurrencesPerYear(c.period)

        const info = getPeriodInfo(c, w.openDate, state.creditsUsed[w.key]?.[c.id]?.usedAt, now)
        if (!info.active) continue
        const rec = state.creditsUsed[w.key]?.[c.id]
        const used = info.key === 'every4years' ? info.status !== 'available' : rec?.periodKey === info.key
        if (!used && urgencyFor(info) === 'critical') expiringSoon += 1
      }
    }

    return { fees, credits, expiringSoon, net: credits - fees, count: state.wallet.length }
  }, [state, now])

  const byPerson = state.people
    .map((p) => ({
      person: p,
      cards: state.wallet.filter((w) => w.ownerId === p.id).map((w) => CARD_BY_ID[w.cardId]).filter(Boolean),
    }))
    .filter((g) => g.cards.length > 0)

  return (
    <div className="page home">
      <motion.section
        className="home-hero"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="eyebrow">{currentQuarterLabel()}</div>
        <h1>
          <CountUp to={summary.count} /> cards
        </h1>

        <Link to="/quick-picks" className="home-cta">
          <span className="home-cta-text">
            <span className="home-cta-main">What card should I use?</span>
            <span className="home-cta-sub">Open Quick Picks</span>
          </span>
          <span className="home-cta-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </motion.section>

      <motion.section
        className="home-numbers"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <HomeStat label="Annual fees" value={money(summary.fees)} />
        <HomeStat label="Credits available" value={money(summary.credits)} />
        <HomeStat
          label={summary.net >= 0 ? 'Ahead by' : 'Behind by'}
          value={money(Math.abs(summary.net))}
          tone={summary.net >= 0 ? 'good' : 'bad'}
        />
        <HomeStat
          label="Expiring soon"
          value={String(summary.expiringSoon)}
          tone={summary.expiringSoon > 0 ? 'bad' : 'good'}
          to="/credits"
        />
      </motion.section>

      <div className="home-wallets">
        {byPerson.map((group, gi) => (
          <motion.section
            key={group.person.id}
            className="home-wallet"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.16 + gi * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="home-wallet-head">
              <span className={`owner-dot ${group.person.color === 'violet' ? 'partner' : 'me'}`} />
              <h2>{group.person.name}</h2>
              <span className="home-wallet-count">
                {group.cards.length} {group.cards.length === 1 ? 'card' : 'cards'}
              </span>
            </div>
            <div className="home-fan">
              {group.cards.map((card) => (
                <CardArt key={card.id} card={card} width={152} className="home-fan-card" />
              ))}
            </div>
          </motion.section>
        ))}
      </div>

      <nav className="home-links" aria-label="Other pages">
        <Link to="/my-cards" className="home-link">
          <strong>My Cards</strong>
          <span>Every multiplier on every card</span>
        </Link>
        <Link to="/which-card" className="home-link">
          <strong>Which Card?</strong>
          <span>Full comparison, point values, quarterly categories</span>
        </Link>
        <Link to="/fee-calculator" className="home-link">
          <strong>Fee Calculator</strong>
          <span>What each annual fee really costs you</span>
        </Link>
        <Link to="/credits" className="home-link">
          <strong>Credit Tracker</strong>
          <span>What's still unused this period</span>
        </Link>
      </nav>
    </div>
  )
}

// Spins from 1 up to the wallet size on load. Uses an ease-out so it decelerates
// into the final number rather than stopping dead. Respects reduced-motion, and
// counts in whole cards — no fractional card ever shows.
function CountUp({ to, duration = 1100 }) {
  const [n, setN] = useState(to > 1 ? 1 : to)

  useEffect(() => {
    const skip =
      to <= 1 ||
      // Browsers pause rAF in a background tab. Without this the counter would
      // sit frozen on "1" until the tab was looked at, which reads as broken.
      document.hidden ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (skip) {
      setN(to)
      return
    }

    let frame
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setN(Math.max(1, Math.round(eased * to)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    // Belt and braces: if the frames stop arriving for any reason, land on the
    // real number rather than stranding the page on a half-finished count.
    const guard = setTimeout(() => setN(to), duration + 250)

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(guard)
    }
  }, [to, duration])

  return (
    <span className="count-up" aria-label={`${to} cards`}>
      {n}
    </span>
  )
}

function HomeStat({ label, value, tone, to }) {
  const body = (
    <>
      <div className={`home-stat-value ${tone ? `tone-${tone}` : ''}`}>{value}</div>
      <div className="home-stat-label">{label}</div>
    </>
  )
  return to ? (
    <Link to={to} className="home-stat is-link">
      {body}
    </Link>
  ) : (
    <div className="home-stat">{body}</div>
  )
}
