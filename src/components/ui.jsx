export function Switch({ on, onChange, label, sub }) {
  return (
    <div className="toggle-row">
      <div>
        <div className="toggle-label">{label}</div>
        {sub && <div className="toggle-sub">{sub}</div>}
      </div>
      <button
        className="switch"
        data-on={on}
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
      />
    </div>
  )
}

export function Segmented({ value, options, onChange, ariaLabel }) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} data-active={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Checkbox({ on, onChange, ariaLabel }) {
  return (
    <button className="checkbox" data-on={on} role="checkbox" aria-checked={on} aria-label={ariaLabel} onClick={() => onChange(!on)}>
      {on && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2.5 6.2 4.8 8.5 9.5 3.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

export function OwnerChip({ person }) {
  if (!person) return null
  return (
    <span className={`chip chip-${person.color === 'violet' ? 'partner' : 'me'}`}>
      <span className={`owner-dot ${person.color === 'violet' ? 'partner' : 'me'}`} />
      {person.name}
    </span>
  )
}

export function Panel({ title, children, action }) {
  return (
    <section className="card-panel panel-pad">
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="panel-title" style={{ marginBottom: 12, flex: 1 }}>
            {title}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

// "Chase" + "Sapphire Reserve" reads well; "Discover" + "Discover it Student"
// does not. Only prefix the issuer when the card name doesn't already carry it.
export const cardTitle = (card) =>
  card.name.toLowerCase().startsWith(card.issuer.toLowerCase()) ? card.name : `${card.issuer} ${card.name}`

// For layouts that already print the issuer on its own line above the name.
export const cardNameOnly = (card) => {
  const prefix = `${card.issuer} `
  return card.name.toLowerCase().startsWith(prefix.toLowerCase())
    ? card.name.slice(prefix.length)
    : card.name
}

export const money = (n) =>
  `$${Math.round(n).toLocaleString('en-US')}`

export const moneyPrecise = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
