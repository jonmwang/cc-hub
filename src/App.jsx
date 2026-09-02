import { NavLink, Route, Routes } from 'react-router-dom'
import { useStore } from './store/StoreContext'
import { reloadToLatest, useUpdateAvailable } from './lib/version'
import Home from './pages/Home'
import MyCards from './pages/MyCards'
import QuickPicks from './pages/QuickPicks'
import WhichCard from './pages/WhichCard'
import FeeCalculator from './pages/FeeCalculator'
import CreditTracker from './pages/CreditTracker'
import Settings from './pages/Settings'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/quick-picks', label: 'Quick Picks' },
  { to: '/my-cards', label: 'My Cards' },
  { to: '/which-card', label: 'Which Card?' },
  { to: '/fee-calculator', label: 'Fee Calculator' },
  { to: '/credits', label: 'Credit Tracker' },
  { to: '/settings', label: 'Settings & Sharing' },
]

export default function App() {
  const { adapter, sharedNotice, dismissSharedNotice } = useStore()
  const storage = adapter.describe()
  const updateAvailable = useUpdateAvailable()

  return (
    <div className="app">
      {updateAvailable && (
        <div className="update-bar" role="status">
          <span>A newer version of CC Hub is available.</span>
          <button className="btn btn-sm" onClick={reloadToLatest}>
            Reload
          </button>
        </div>
      )}
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark">CC</span>
          CC Hub
        </NavLink>

        <nav className="nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar-right">
          <span className="storage-pill" title={storage.detail}>
            <span className="dot" />
            {storage.detail}
          </span>
        </div>
      </header>

      <main>
        {sharedNotice && (
          <div className="page" style={{ paddingBottom: 0 }}>
            <div className="banner">
              <span>
                Loaded a shared setup from that link. It is saved in this browser now — edits you make
                here stay on this device.
              </span>
              <button className="btn btn-sm" onClick={dismissSharedNotice}>
                Got it
              </button>
            </div>
          </div>
        )}

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/my-cards" element={<MyCards />} />
          <Route path="/quick-picks" element={<QuickPicks />} />
          <Route path="/which-card" element={<WhichCard />} />
          <Route path="/fee-calculator" element={<FeeCalculator />} />
          <Route path="/credits" element={<CreditTracker />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
