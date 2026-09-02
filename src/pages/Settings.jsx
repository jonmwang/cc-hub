import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store/StoreContext'
import { CARDS, CARD_BY_ID } from '../data/cards'
import { buildShareUrl, downloadBackup } from '../lib/storage'
import { Panel, cardTitle, money } from '../components/ui'

export default function Settings() {
  const { state, actions } = useStore()
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [addCardId, setAddCardId] = useState(CARDS[0].id)
  const [addOwner, setAddOwner] = useState('me')
  const fileRef = useRef(null)

  const people = useMemo(() => Object.fromEntries(state.people.map((p) => [p.id, p])), [state.people])

  const makeLink = () => {
    const url = buildShareUrl(state)
    setShareUrl(url)
    setCopied(false)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const importFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        actions.replaceState(JSON.parse(String(reader.result)))
      } catch {
        window.alert('That file could not be read as a CC Hub backup.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Settings & sharing</h1>
        <p>
          Everything lives in this browser. Nothing is uploaded anywhere, and no personal data is baked
          into the code — which is what makes the site itself safe to share publicly.
        </p>
      </div>

      <div className="settings-grid">
        <Panel title="Who's in the household">
          {state.people.map((p) => (
            <div key={p.id} style={{ marginBottom: 12 }}>
              <label className="toggle-sub" style={{ display: 'block', marginBottom: 5 }}>
                <span className={`owner-dot ${p.color === 'violet' ? 'partner' : 'me'}`} /> {p.id === 'me' ? 'You' : 'Partner'}
              </label>
              <input
                type="text"
                value={p.name}
                onChange={(e) => actions.renamePerson(p.id, e.target.value)}
                aria-label={`Name for ${p.id}`}
              />
            </div>
          ))}
          <p className="hint">Names show up on every page as colour-coded chips.</p>
        </Panel>

        <Panel title="Send your setup to someone">
          <button className="btn btn-primary btn-block" onClick={makeLink}>
            Generate share link
          </button>
          {shareUrl && (
            <>
              <div className="share-box">
                <input type="text" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
                <button className="btn" onClick={copyLink}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="hint">
                The link carries your whole setup inside it. Whoever opens it gets a copy saved to their
                own browser — their later edits stay on their device, and yours stay on yours. Send a
                fresh link whenever you want to push an update across.
              </p>
            </>
          )}
          {!shareUrl && (
            <p className="hint">
              Creates a link containing your cards, values, and credit history. Good for handing your
              partner a ready-made copy.
            </p>
          )}
        </Panel>

        <Panel title="Backup & restore">
          <button className="btn btn-block" onClick={() => downloadBackup(state)}>
            Download backup file
          </button>
          <button className="btn btn-block" style={{ marginTop: 8 }} onClick={() => fileRef.current?.click()}>
            Restore from backup
          </button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={importFile} />
          <p className="hint">
            Clearing your browser data wipes the app. Download a backup occasionally, or before switching
            machines.
          </p>
        </Panel>

        <Panel title="Danger zone">
          <button className="btn btn-block btn-danger" onClick={() => confirmThen('Remove every card from the wallet?', actions.clearWallet)}>
            Clear all cards
          </button>
          <button
            className="btn btn-block btn-danger"
            style={{ marginTop: 8 }}
            onClick={() => confirmThen('Reset everything back to the starting setup?', actions.resetAll)}
          >
            Reset to defaults
          </button>
          <p className="hint">Clear the wallet before sharing this site with someone who should start fresh.</p>
        </Panel>
      </div>

      <div className="section-head">
        <div>
          <h2>Wallet</h2>
          <div className="sub">Add or remove cards, and set open dates for anniversary-based credits.</div>
        </div>
      </div>

      <Panel>
        <div className="add-card-row">
          <select value={addCardId} onChange={(e) => setAddCardId(e.target.value)} aria-label="Card to add">
            {CARDS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.issuer} {c.name}
              </option>
            ))}
          </select>
          <select value={addOwner} onChange={(e) => setAddOwner(e.target.value)} aria-label="Cardholder">
            {state.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => actions.addCard(addCardId, addOwner)}>
            Add card
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          {state.wallet.length === 0 && <p className="hint">The wallet is empty.</p>}
          {state.wallet.map((w) => {
            const card = CARD_BY_ID[w.cardId]
            const usesAnniversary = card.credits.some((c) => c.period === 'anniversary')
            return (
              <div className="credit-item" key={w.key} style={{ paddingLeft: 0, paddingRight: 0 }}>
                <span className={`owner-dot ${people[w.ownerId]?.color === 'violet' ? 'partner' : 'me'}`} />
                <div className="ci-main">
                  <div className="ci-name">
                    {cardTitle(card)}
                  </div>
                  <div className="ci-meta">
                    <span>{people[w.ownerId]?.name}</span>
                    <span>· {card.annualFee === 0 ? 'No annual fee' : `${money(card.annualFee)}/yr`}</span>
                  </div>
                </div>
                {usesAnniversary && (
                  <input
                    type="date"
                    style={{ width: 168 }}
                    value={w.openDate ?? ''}
                    onChange={(e) => actions.setOpenDate(w.key, e.target.value || null)}
                    aria-label={`${card.name} open date`}
                  />
                )}
                <button className="btn btn-sm btn-danger" onClick={() => actions.removeCard(w.key)}>
                  Remove
                </button>
              </div>
            )
          })}
        </div>
      </Panel>

      <div className="section-head">
        <div>
          <h2>Going multiplayer later</h2>
        </div>
      </div>
      <Panel>
        <p className="hint" style={{ marginTop: 0 }}>
          Right now each browser keeps its own copy. To make edits sync live between you and your partner,
          the only file that needs changing is <code>src/lib/storage.js</code> — write a second adapter with
          the same four methods and point <code>getAdapter()</code> at it. No page or component reads storage
          directly, so nothing else has to change. <code>REMOTE_ADAPTER_NOTES.md</code> in the project root
          walks through it with Firebase.
        </p>
      </Panel>
    </div>
  )
}

function confirmThen(message, fn) {
  if (window.confirm(message)) fn()
}
