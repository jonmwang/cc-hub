import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store/StoreContext'
import { CARD_BY_ID } from '../data/cards'
import { isLiveClaim } from '../lib/sync/merge'
import { currentQuarterLabel, getPeriodInfo, isExpiringSoon } from '../lib/periods'
import CardArt from '../components/CardArt'
import { money } from '../components/ui'

// A landing page, not a dashboard. One headline number set, one obvious button,
// and the wallet as a picture. Everything detailed lives one click away.
export default function Home() {
  const { state } = useStore()
  const now = useMemo(() => new Date(), [])

  const summary = useMemo(() => {
    let fees = 0
    let openNow = 0 // unused, window currently open — money genuinely still on the table
    let expiringSoon = 0

    for (const w of state.wallet) {
      const card = CARD_BY_ID[w.cardId]
      if (!card) continue
      fees += card.annualFee

      for (const c of card.credits) {
        const value = state.creditValues[w.key]?.[c.id] ?? c.value
        const info = getPeriodInfo(c, w.openDate, state.creditsUsed[w.key]?.[c.id]?.usedAt, now)
        if (!info.active) continue

        const rec = state.creditsUsed[w.key]?.[c.id]
        const used = info.key === 'every4years' ? info.status !== 'available' : rec?.periodKey === info.key
        if (used) continue

        openNow += value
        if (isExpiringSoon(info)) expiringSoon += 1
      }
    }

    // What you have actually clawed back this calendar year, from the usage log
    // rather than from the catalogue — this is the number that answers "am I
    // ahead", and it only counts credits you really ticked off.
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime()
    const recovered = state.creditsLog
      .filter((e) => isLiveClaim(e) && new Date(e.usedAt).getTime() >= yearStart)
      .reduce((sum, e) => sum + (e.value ?? 0), 0)

    return { fees, openNow, expiringSoon, recovered, net: recovered - fees, count: state.wallet.length }
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
        <HomeStat label="Annual fees" value={money(summary.fees)} note={`${new Date().getFullYear()} total`} />
        <HomeStat
          label="Recovered so far"
          value={money(summary.recovered)}
          note="Credits you've ticked off"
          to="/credits"
        />
        <HomeStat
          label="Still claimable"
          value={money(summary.openNow)}
          note="Unused, window open now"
          to="/credits"
        />
        <HomeStat
          label={summary.net >= 0 ? 'Ahead by' : 'Still to recover'}
          value={money(Math.abs(summary.net))}
          tone={summary.net >= 0 ? 'good' : undefined}
          note={summary.net >= 0 ? 'Fees fully covered' : `${pct(summary.recovered, summary.fees)}% of fees back`}
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

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

function HomeStat({ label, value, tone, to, note }) {
  const body = (
    <>
      <div className={`home-stat-value ${tone ? `tone-${tone}` : ''}`}>{value}</div>
      <div className="home-stat-label">{label}</div>
      {note && <div className="home-stat-note">{note}</div>}
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
