import { useCallback, useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, ClipboardList, Store, Users, IndianRupee, MessageSquareWarning, LogOut, Menu, X, ShoppingCart,
} from 'lucide-react'
import { useAuth } from '../shared/context/AuthContext.jsx'
import { api } from '../shared/api/client.js'
import { Logo } from '../shared/components/AuthShell.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Products from './pages/Products.jsx'
import Orders from './pages/Orders.jsx'
import StoreSettings from './pages/StoreSettings.jsx'
import Staff from './pages/Staff.jsx'
import Earnings from './pages/Earnings.jsx'
import Counter from './pages/Counter.jsx'
import Complaints from './pages/Complaints.jsx'
import './admin.css'

// ─────────────────────────────────────────────────────────────
//  Shop Owner / Store Admin dashboard  (/admin/*)
//  Pudhu page add panna: NAV la oru item + Routes la oru Route.
// ─────────────────────────────────────────────────────────────
const NAV = [
  { to: '/admin',            label: 'Dashboard',  icon: LayoutDashboard, end: true },
  { to: '/admin/orders',     label: 'Orders',     icon: ClipboardList },
  { to: '/admin/counter',    label: 'Counter sale', icon: ShoppingCart },
  { to: '/admin/products',   label: 'Products',   icon: Package },
  { to: '/admin/complaints', label: 'Returns & Complaints', icon: MessageSquareWarning },
  { to: '/admin/earnings',   label: 'Earnings',   icon: IndianRupee },
  { to: '/admin/staff',      label: 'Staff',      icon: Users },
  { to: '/admin/store',      label: 'Store settings', icon: Store },
]

export default function AdminApp() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [store, setStore]   = useState(null)
  const [navOpen, setNav]   = useState(false)
  const [toggling, setTog]  = useState(false)

  const loadStore = useCallback(() => api.get('/api/admin/store').then(setStore).catch(() => {}), [])
  useEffect(() => { loadStore() }, [loadStore])
  // new delivery partner requests -> small badge on Staff
  const [riderReqs, setRiderReqs] = useState(0)
  useEffect(() => {
    const check = () => api.get('/api/admin/rider-requests').then(r => setRiderReqs(r.length)).catch(() => {})
    check()
    const t = setInterval(check, 60000)
    return () => clearInterval(t)
  }, [])

  const toggleOpen = async () => {
    if (!store) return
    setTog(true)
    try {
      const res = await api.patch('/api/admin/store/availability', { is_open: !store.is_open })
      setStore((s) => ({ ...s, is_open: res.is_open }))
    } finally { setTog(false) }
  }

  const doLogout = () => { logout(); navigate('/login') }

  return (
    <div className="ad-root">
      <aside className={`ad-side ${navOpen ? 'open' : ''}`}>
        <div className="ad-brand">
          <Logo size={36} />
          <div>
            <b>FreshMart</b>
            <span>Store admin</span>
          </div>
          <button className="ad-icon-btn ad-side-close" aria-label="Close menu" onClick={() => setNav(false)}><X size={18} /></button>
        </div>
        <nav className="ad-nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setNav(false)} className={({ isActive }) => `ad-nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} /> {label}
              {to === '/admin/staff' && riderReqs > 0 && <span className="ad-nav-badge" aria-label={`${riderReqs} new requests`}>{riderReqs}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="ad-side-foot">
          <div className="ad-me">
            <span className="ad-me-av">{(user?.name || 'A').charAt(0).toUpperCase()}</span>
            <div><b>{user?.name}</b><span>{user?.email || (user?.phone ? `+91 ${user.phone}` : '')}</span></div>
          </div>
          <button className="ad-logout" onClick={doLogout}><LogOut size={16} /> Log out</button>
        </div>
      </aside>
      {navOpen && <div className="ad-side-back" onClick={() => setNav(false)} />}

      <div className="ad-main">
        <header className="ad-top">
          <button className="ad-icon-btn ad-burger" aria-label="Open menu" onClick={() => setNav(true)}><Menu size={20} /></button>
          <div className="ad-top-store">
            <b>{store?.name || 'Your store'}</b>
            {store && <span>{store.address?.city}</span>}
          </div>
          {store && (
            <button
              className={`ad-open-toggle ${store.is_open ? 'on' : ''}`}
              onClick={toggleOpen} disabled={toggling} role="switch" aria-checked={store.is_open}
              title="Closed stores are hidden from customers"
            >
              <span className="ad-switch" /> {store.is_open ? 'Store open' : 'Store closed'}
            </button>
          )}
        </header>

        <main className="ad-content">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="products" element={<Products />} />
            <Route path="complaints" element={<Complaints />} />
            <Route path="earnings" element={<Earnings />} />
            <Route path="counter" element={<Counter />} />
            <Route path="staff" element={<Staff />} />
            <Route path="store" element={<StoreSettings onSaved={setStore} />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
