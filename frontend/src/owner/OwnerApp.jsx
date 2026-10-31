import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Store, MapPinned, Users, IndianRupee, BarChart3, Headset, LogOut, Menu, X, Inbox } from 'lucide-react'
import { useAuth } from '../shared/context/AuthContext.jsx'
import { api } from '../shared/api/client.js'
import Overview from './pages/Overview.jsx'
import Stores from './pages/Stores.jsx'
import AreasOffers from './pages/AreasOffers.jsx'
import UsersPage from './pages/Users.jsx'
import Money from './pages/Money.jsx'
import Reports from './pages/Reports.jsx'
import SupportTeam from './pages/SupportTeam.jsx'
import '../admin/admin.css'
import './owner.css'

// ─────────────────────────────────────────────────────────────
//  FreshMart owner (super admin)  (/owner/*)
//  Number .env la SUPER_ADMIN_PHONES la irundha mattum indha page open aagum.
// ─────────────────────────────────────────────────────────────
const NAV = [
  { to: '/owner',              label: 'Overview',             icon: LayoutDashboard, end: true },
  { to: '/owner/stores',       label: 'Stores',               icon: Store },
  { to: '/owner/areas',        label: 'Areas, offers & delivery', icon: MapPinned },
  { to: '/owner/users',        label: 'Users',                icon: Users },
  { to: '/owner/money',        label: 'Commission & payouts', icon: IndianRupee },
  { to: '/owner/reports',      label: 'Reports',              icon: BarChart3 },
  { to: '/owner/support-team', label: 'Support team',         icon: Headset },
]

export default function OwnerApp() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [navOpen, setNav] = useState(false)
  const [counts, setCounts] = useState(null)

  useEffect(() => {
    const load = () => api.get('/api/owner/support-counts').then(setCounts).catch(() => {})
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="ad-root ow">
      <aside className={`ad-side ${navOpen ? 'open' : ''}`}>
        <div className="ad-brand">
          <span className="ow-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
          </span>
          <div><b>FreshMart</b><span>Platform owner</span></div>
          <button className="ad-icon-btn ad-side-close" aria-label="Close menu" onClick={() => setNav(false)}><X size={18} /></button>
        </div>
        <nav className="ad-nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setNav(false)} className={({ isActive }) => `ad-nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
          <NavLink to="/support" className="ad-nav-link">
            <Inbox size={18} /> Support inbox
            {counts?.open > 0 && <span className="ad-nav-badge" aria-label={`${counts.open} open tickets`}>{counts.open}</span>}
          </NavLink>
        </nav>
        <div className="ad-side-foot">
          <div className="ad-me">
            <span className="ad-me-av">{(user?.name || 'O').charAt(0).toUpperCase()}</span>
            <div><b>{user?.name}</b><span>+91 {user?.phone}</span></div>
          </div>
          <button className="ad-logout" onClick={() => { logout(); navigate('/login') }}><LogOut size={16} /> Log out</button>
        </div>
      </aside>
      {navOpen && <div className="ad-side-back" onClick={() => setNav(false)} />}

      <div className="ad-main">
        <header className="ad-top">
          <button className="ad-icon-btn ad-burger" aria-label="Open menu" onClick={() => setNav(true)}><Menu size={20} /></button>
          <div className="ad-top-store"><b>FreshMart marketplace</b><span>All stores · all areas</span></div>
        </header>
        <main className="ad-content">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="stores" element={<Stores />} />
            <Route path="areas" element={<AreasOffers />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="money" element={<Money />} />
            <Route path="reports" element={<Reports />} />
            <Route path="support-team" element={<SupportTeam />} />
            <Route path="*" element={<Navigate to="/owner" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
