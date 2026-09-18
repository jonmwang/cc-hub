import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store/StoreContext'
import { CATEGORIES, CATEGORY_BY_ID, CATEGORY_GROUPS } from '../data/categories'
import { CARD_BY_ID } from '../data/cards'
import { CURRENCIES, CURRENCY_LIST } from '../data/currencies'
import { activeRotatingCategories, formatMultiplier, formatValue, rankCardsForCategory, rotatingSource } from '../lib/ranking'
import { currentQuarterLabel } from '../lib/periods'
import CardArt from '../components/CardArt'
import { OwnerChip, Panel, Segmented, Switch, cardTitle } from '../components/ui'

// Categories a rotating card can plausibly be assigned in a given quarter.
const ROTATING_CHOICES = [
  'groceries',
  'gas',
  'dining',
  'drugstores',
  'wholesale',
  'online_retail',
  'transit',
  'rideshare',
  'streaming',
  'entertainment',
  'travel_other',
  'phone',
  'utilities',
  'red_cross',
]

export default function WhichCard() {
  const { state, actions } = useStore()
  const [categoryId, setCategoryId] = useState('dining')

  const people = state.people
  const personById = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people])

  const ranked = useMemo(() => rankCardsForCategory(state, categoryId), [state, categoryId])
  const category = CATEGORY_BY_ID[categoryId]

  const rotatingEntries = state.wallet.filter((w) => CARD_BY_ID[w.cardId]?.rotating)

  // Seasonal categories (Red Cross) only earn anything in a quarter where some
  // rotating card has them, so only offer them then.
  const activeSeasonal = new Set(rotatingEntries.flatMap((w) => activeRotatingCategories(state, w.key)))
  const pickable = CATEGORIES.filter((c) => !c.seasonal || activeSeasonal.has(c.id))

  return (
    <div className="page page-wide">
      <div className="page-head">
        <h1>Which card should I use?</h1>
        <p>
          Pick what you are buying. Cards re-sort instantly by how much each one is actually worth per
          dollar — the multiplier times what you value that currency at, not the raw multiplier.
        </p>
      </div>

      <div className="split">
        <aside className="sidebar">
          <Panel title="Valuation mode">
            <Segmented
              ariaLabel="Valuation mode"
              value={state.settings.valuationMode}
              onChange={(v) => actions.setSetting({ valuationMode: v })}
              options={[
                { value: 'points', label: 'Points priority' },
                { value: 'cashback_ok', label: 'Cash back is fine' },
              ]}
            />
            <p className="hint">
              {state.settings.valuationMode === 'points'
                ? 'Each currency is worth what you set below, so 3x transferable points can beat 5% cash back.'
                : 'Every point counts as exactly one cent, so the highest raw multiplier wins.'}
            </p>
          </Panel>

          <Panel title="Filters">
            <Segmented
              ariaLabel="Filter by cardholder"
              value={state.settings.ownerFilter}
              onChange={(v) => actions.setSetting({ ownerFilter: v })}
              options={[{ value: 'all', label: 'Everyone' }, ...people.map((p) => ({ value: p.id, label: p.name }))]}
            />
            <div style={{ marginTop: 4 }}>
              <Switch
                label="Hide cash-back-only cards"
                sub="Drops cards whose rewards cannot become transferable points."
                on={state.settings.hideCashbackOnly}
                onChange={(v) => actions.setSetting({ hideCashbackOnly: v })}
              />
            </div>
          </Panel>

          <Panel
            title="Point values (¢ each)"
            action={
              <button className="btn btn-sm" onClick={actions.resetValuations}>
                Reset
              </button>
            }
          >
            {state.settings.valuationMode === 'cashback_ok' && (
              <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
                Ignored while “Cash back is fine” is on.
              </p>
            )}
            {CURRENCY_LIST.map((c) => (
              <div className="cpp-row" key={c.id}>
                <div className="cpp-head">
                  <span className="cpp-name">{c.label}</span>
                  {c.locked ? (
                    <span className="cpp-locked">1.00¢ fixed</span>
                  ) : (
                    <span className="cpp-val">{(state.valuations[c.id] ?? c.defaultCpp).toFixed(2)}¢</span>
                  )}
                </div>
                {!c.locked && (
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.05"
                    value={state.valuations[c.id] ?? c.defaultCpp}
                    disabled={state.settings.valuationMode === 'cashback_ok'}
                    onChange={(e) => actions.setValuation(c.id, Number(e.target.value))}
                    aria-label={`${c.label} cents per point`}
                  />
                )}
                {c.note && <div className="toggle-sub">{c.note}</div>}
              </div>
            ))}
          </Panel>

          <Panel title={`Rotating categories · ${currentQuarterLabel()}`}>
            <div className="rotating-editor">
              {rotatingEntries.length === 0 && (
                <p className="hint" style={{ margin: 0 }}>No rotating-category cards in the wallet.</p>
              )}
              {rotatingEntries.map((w) => {
                const card = CARD_BY_ID[w.cardId]
                const source = rotatingSource(state, w.key)
                const selected = source.categories
                return (
                  <div key={w.key}>
                    <div className="rot-card-name">
                      <span className={`owner-dot ${personById[w.ownerId]?.color === 'violet' ? 'partner' : 'me'}`} />
                      {card.name}
                    </div>
                    <p className="rot-hint">{card.rotatingNote}</p>
                    {source.from === 'announced' && (
                      <p className="rot-hint">
                        Filled in from the{' '}
                        <a href={source.announced.source} target="_blank" rel="noreferrer">
                          official announcement
                        </a>
                        . Tap to override.
                      </p>
                    )}
                    <div className="rot-options">
                      {ROTATING_CHOICES.map((cid) => {
                        const on = selected.includes(cid)
                        return (
                          <button
                            key={cid}
                            className="rot-opt"
                            data-on={on}
                            onClick={() =>
                              actions.setRotatingCategories(
                                w.key,
                                on ? selected.filter((x) => x !== cid) : [...selected, cid],
                              )
                            }
                          >
                            {CATEGORY_BY_ID[cid]?.label ?? cid}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              <div className="rot-locked-note">
                Only rotating-category cards can be edited here. Every other card uses its published,
                fixed earn rates so nothing incorrect can creep in. Picks are stamped with the quarter
                and clear themselves when a new one starts — at which point the issuer's announced
                categories take over, if they've been published.
              </div>
            </div>
          </Panel>

          <MerchantQuirks state={state} actions={actions} />
        </aside>

        <div>
          <section className="card-panel panel-pad" style={{ marginBottom: 20 }}>
            <div className="category-picker">
              {CATEGORY_GROUPS.map((group) => (
                <div key={group}>
                  <div className="cat-group-label">{group}</div>
                  <div className="cat-buttons">
                    {pickable.filter((c) => c.group === group).map((c) => (
                      <button
                        key={c.id}
                        className="cat-btn"
                        data-active={c.id === categoryId}
                        onClick={() => setCategoryId(c.id)}
                        title={c.hint}
                      >
                        <span aria-hidden="true">{c.icon}</span>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="section-head" style={{ marginTop: 0 }}>
            <div>
              <h2>
                {category.icon} {category.label}
              </h2>
              <div className="sub">{category.hint}</div>
            </div>
          </div>

          {ranked.length === 0 ? (
            <div className="empty">
              <strong>Nothing to rank</strong>
              Every card is filtered out. Loosen the filters in the sidebar.
            </div>
          ) : (
            <motion.ul className="rank-list" layout>
              <AnimatePresence initial={false}>
                {ranked.map((row, i) => (
                  <RankRow key={row.key} row={row} index={i} person={personById[row.ownerId]} state={state} />
                ))}
              </AnimatePresence>
            </motion.ul>
          )}
        </div>
      </div>
    </div>
  )
}

// Stores whose merchant coding doesn't match the category you'd expect. Edited
// here by the person who tracks this stuff; rendered read-only on Quick Picks.
function MerchantQuirks({ state, actions }) {
  const walletCardIds = [...new Set(state.wallet.map((w) => w.cardId))]

  return (
    <Panel
      title="Merchant quirks"
      action={
        <button
          className="btn btn-sm"
          onClick={() => actions.addMerchantRule({ name: 'New place', categoryId: 'groceries' })}
        >
          Add
        </button>
      }
    >
      {state.merchantRules.length === 0 && (
        <p className="hint" style={{ margin: 0 }}>
          Nothing added. Use this for stores that ring up as the wrong category.
        </p>
      )}

      {state.merchantRules.map((rule) => (
        <div className="quirk" key={rule.id}>
          <div className="quirk-top">
            <input
              type="text"
              className="quirk-name"
              value={rule.name}
              onChange={(e) => actions.updateMerchantRule(rule.id, { name: e.target.value })}
              aria-label="Merchant name"
            />
            <button
              className="btn btn-sm btn-danger"
              onClick={() => actions.removeMerchantRule(rule.id)}
              aria-label={`Remove ${rule.name}`}
            >
              ✕
            </button>
          </div>

          <div className="quirk-field">
            <label htmlFor={`cat-${rule.id}`}>Rings up as</label>
            <select
              id={`cat-${rule.id}`}
              value={rule.categoryId}
              onChange={(e) => actions.updateMerchantRule(rule.id, { categoryId: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="quirk-field">
            <label>Cards that don’t earn it here</label>
            <div className="quirk-excl">
              {walletCardIds.map((cardId) => {
                const off = rule.excludedCardIds.includes(cardId)
                return (
                  <button
                    key={cardId}
                    className="quirk-chip"
                    data-off={off}
                    onClick={() =>
                      actions.updateMerchantRule(rule.id, {
                        excludedCardIds: off
                          ? rule.excludedCardIds.filter((c) => c !== cardId)
                          : [...rule.excludedCardIds, cardId],
                      })
                    }
                  >
                    {CARD_BY_ID[cardId]?.name ?? cardId}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="quirk-field">
            <label htmlFor={`note-${rule.id}`}>Note</label>
            <input
              id={`note-${rule.id}`}
              type="text"
              value={rule.note ?? ''}
              placeholder="Why it's an exception"
              onChange={(e) => actions.updateMerchantRule(rule.id, { note: e.target.value })}
            />
          </div>
        </div>
      ))}

      <p className="hint">These show up at the top of the Quick Picks page.</p>
    </Panel>
  )
}

function RankRow({ row, index, person, state }) {
  const ownerClass = person?.color === 'violet' ? 'owner-partner' : 'owner-me'
  const isTop = index === 0
  const currency = CURRENCIES[row.card.currency]

  return (
    <motion.li
      layout
      layoutId={row.key}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{
        layout: { type: 'spring', stiffness: 420, damping: 36, mass: 0.9 },
        duration: 0.24,
      }}
      className={`rank-row ${ownerClass} ${isTop ? 'top' : ''}`}
    >
      <div className="rank-pos">{index + 1}</div>

      <CardArt card={row.card} width={62} showText={false} className="rank-art" />

      <div className="rank-main">
        <div className="rank-name">
          {cardTitle(row.card)}
          {isTop && <span className="chip chip-best">Best</span>}
          {row.isRotating && <span className="chip chip-rotating">Quarterly 5%</span>}
          {row.cashbackOnly && <span className="chip chip-cash">Cash back</span>}
        </div>
        <div className="rank-sub">
          <OwnerChip person={person} />{' '}
          <span style={{ marginLeft: 6 }}>
            {formatMultiplier(row.multiplier)} {currency.short}
            {state.settings.valuationMode === 'points' && !currency.locked
              ? ` at ${row.cpp.toFixed(2)}¢`
              : ''}
          </span>
        </div>
      </div>

      <div className="rank-value">
        <div className="rank-mult">{formatValue(row.value)}</div>
        <div className="rank-cents">per $1</div>
      </div>
    </motion.li>
  )
}
