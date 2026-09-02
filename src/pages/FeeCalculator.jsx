import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store/StoreContext'
import { CARD_BY_ID } from '../data/cards'
import { occurrencesPerYear } from '../lib/periods'
import CardArt from '../components/CardArt'
import { Checkbox, OwnerChip, Panel, cardTitle, money } from '../components/ui'

const PERIOD_LABEL = {
  monthly: '× 12 / yr',
  quarterly: '× 4 / yr',
  semiannual: 'once / yr',
  annual: 'once / yr',
  anniversary: 'once / yr',
  every4years: 'every 4 yrs',
}

export default function FeeCalculator() {
  const { state, actions } = useStore()
  const withFees = state.wallet
  const [selectedKey, setSelectedKey] = useState(() => withFees[0]?.key ?? null)

  // Credits the user has decided not to count at all.
  const [excluded, setExcluded] = useState({})

  const people = useMemo(() => Object.fromEntries(state.people.map((p) => [p.id, p])), [state.people])
  const entry = withFees.find((w) => w.key === selectedKey) ?? withFees[0]
  const card = entry ? CARD_BY_ID[entry.cardId] : null

  const excludedForCard = excluded[entry?.key] ?? {}

  const totals = useMemo(() => {
    if (!card || !entry) return { face: 0, personal: 0, effective: 0 }
    let face = 0
    let personal = 0
    for (const c of card.credits) {
      const perYear = occurrencesPerYear(c.period)
      face += c.value * perYear
      if (excludedForCard[c.id]) continue
      const v = state.creditValues[entry.key]?.[c.id] ?? c.value
      personal += v * perYear
    }
    return { face, personal, effective: card.annualFee - personal }
  }, [card, entry, state.creditValues, excludedForCard])

  if (!entry || !card) {
    return (
      <div className="page">
        <div className="page-head">
          <h1>Effective annual fee</h1>
        </div>
        <div className="empty">
          <strong>No cards in the wallet</strong>
          Add some from Settings & Sharing first.
        </div>
      </div>
    )
  }

  const setValue = (creditId, raw) => {
    const n = Number(raw)
    actions.setCreditValue(entry.key, creditId, Number.isFinite(n) && n >= 0 ? n : 0)
  }

  const toggleExcluded = (creditId, on) =>
    setExcluded((e) => ({ ...e, [entry.key]: { ...(e[entry.key] ?? {}), [creditId]: !on } }))

  return (
    <div className="page page-wide">
      <div className="page-head">
        <h1>Effective annual fee</h1>
        <p>
          Face value is what the issuer advertises. Change each number to what the credit is genuinely
          worth to you — a $500 hotel credit you would only ever get $300 of use from is worth $300.
        </p>
      </div>

      <div className="split">
        <aside className="sidebar">
          <Panel title="Choose a card">
            <div className="picker-list">
              {withFees.map((w) => {
                const c = CARD_BY_ID[w.cardId]
                const person = people[w.ownerId]
                return (
                  <button
                    key={w.key}
                    className="picker-item"
                    data-active={w.key === entry.key}
                    onClick={() => setSelectedKey(w.key)}
                  >
                    <span className={`owner-dot ${person?.color === 'violet' ? 'partner' : 'me'}`} />
                    <CardArt card={c} width={40} showText={false} className="picker-art" />
                    <span className="picker-name">{c.name}</span>
                    <span className="picker-fee">{c.annualFee === 0 ? '$0' : money(c.annualFee)}</span>
                  </button>
                )
              })}
            </div>
          </Panel>

          <Panel title="Reset">
            <button className="btn btn-block" onClick={() => actions.resetCreditValues(entry.key)}>
              Restore face values for {card.name}
            </button>
            <p className="hint">Puts every credit on this card back to the issuer's advertised amount.</p>
          </Panel>
        </aside>

        <div>
          <div className="section-head" style={{ marginTop: 0, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <CardArt card={card} width={104} />
              <div>
                <h2>{cardTitle(card)}</h2>
                <div className="sub" style={{ marginTop: 6 }}>
                  <OwnerChip person={people[entry.ownerId]} />
                </div>
              </div>
            </div>
          </div>

          <div className="fee-summary">
            <div className="fee-cell">
              <div className="fee-cell-label">Annual fee</div>
              <div className="fee-cell-value">{money(card.annualFee)}</div>
            </div>
            <div className="fee-cell">
              <div className="fee-cell-label">Credits at face</div>
              <div className="fee-cell-value">{money(totals.face)}</div>
            </div>
            <div className="fee-cell">
              <div className="fee-cell-label">Worth to you</div>
              <div className="fee-cell-value">{money(totals.personal)}</div>
              <div className="fee-cell-note">Your adjusted values</div>
            </div>
            <div className="fee-cell highlight">
              <div className="fee-cell-label">Effective fee</div>
              <motion.div
                key={Math.round(totals.effective)}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className={`fee-cell-value ${totals.effective <= 0 ? 'value-positive' : ''}`}
              >
                {totals.effective <= 0 ? `+${money(-totals.effective)}` : money(totals.effective)}
              </motion.div>
              <div className="fee-cell-note">
                {totals.effective <= 0 ? 'Net positive before any points earned' : 'Out of pocket per year'}
              </div>
            </div>
          </div>

          {card.credits.length === 0 ? (
            <div className="empty">
              <strong>No recurring credits on this card</strong>
              Its value comes entirely from the earn rates.
            </div>
          ) : (
            <div className="credit-table">
              <div className="credit-row credit-head">
                <div>Use</div>
                <div>Credit</div>
                <div style={{ textAlign: 'right' }}>Face</div>
                <div>Worth to you</div>
              </div>

              {card.credits.map((c) => {
                const included = !excludedForCard[c.id]
                const value = state.creditValues[entry.key]?.[c.id] ?? c.value
                const perYear = occurrencesPerYear(c.period)
                return (
                  <div className={`credit-row ${included ? '' : 'off'}`} key={c.id}>
                    <Checkbox
                      on={included}
                      onChange={(on) => toggleExcluded(c.id, on)}
                      ariaLabel={`Count ${c.label} toward the effective fee`}
                    />
                    <div>
                      <div className="credit-name">{c.label}</div>
                      <div className="credit-note">
                        {PERIOD_LABEL[c.period]}
                        {c.note ? ` · ${c.note}` : ''}
                      </div>
                    </div>
                    <div className="credit-face">
                      {money(c.value)}
                      {perYear !== 1 && <div style={{ fontSize: 11 }}>{money(c.value * perYear)}/yr</div>}
                    </div>
                    <div className="credit-input-wrap">
                      <span>$</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={value}
                        disabled={!included}
                        onChange={(e) => setValue(c.id, e.target.value)}
                        aria-label={`Your value for ${c.label}`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {card.notes?.length > 0 && (
            <section className="card-panel panel-pad" style={{ marginTop: 16 }}>
              <div className="panel-title">Notes</div>
              <ul className="notes-list" style={{ fontSize: 13 }}>
                {card.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
