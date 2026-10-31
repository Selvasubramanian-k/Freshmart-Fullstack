import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { homeFor } from '../utils/roles.js'
import FullPageLoader from '../components/FullPageLoader.jsx'
import '../auth/auth.css'

// ─────────────────────────────────────────────────────────────
//  Login aana udane oru welcome page (role wise), apram avanga home.
//  Neraa /welcome open panna (login illama) -> home ku redirect.
// ─────────────────────────────────────────────────────────────
const rs = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const first = (name) => (name || '').trim().split(/\s+/)[0] || 'there'
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,' }
const BAG = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>

function Ic({ d }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d.split('|').map((p) => <path key={p} d={p} />)}</svg>
}
const PIN = 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0|M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'
const BOX = 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z|m3.3 7 8.7 5 8.7-5|M12 22V12'
const WALLET = 'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1|M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4'
const TAG = 'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z|M7.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z'
const STATUS = { placed: 'placed', confirmed: 'accepted by the store', packed: 'packed', out_for_delivery: 'on the way', delivered: 'delivered', cancelled: 'cancelled' }

// ---------------- Customer ----------------
function CustomerWelcome({ user, isNew }) {
  const navigate = useNavigate()
  const [p, setP] = useState(0)
  const [last, setLast] = useState(null)
  const [wallet, setWallet] = useState(0)

  useEffect(() => {
    if (isNew) return
    api.get('/api/customer/orders').then((o) => setLast(Array.isArray(o) && o.length ? o[0] : null)).catch(() => {})
    api.get('/api/customer/wallet').then((w) => setWallet(w.balance || 0)).catch(() => {})
  }, [isNew])
  useEffect(() => {
    const t = setInterval(() => setP((v) => Math.min(100, v + 4)), 100)
    return () => clearInterval(t)
  }, [])
  useEffect(() => { if (p >= 100) { const t = setTimeout(() => navigate('/', { replace: true }), 300); return () => clearTimeout(t) } }, [p, navigate])

  const addr = user.address
  return (
    <div className="wl wl-cust">
      <div className="wl-cust-in">
        <div className="wl-brand"><span className="wl-mark light">{BAG}</span><b>FreshMart</b></div>
        <div className="wl-hi">
          {user.name?.trim()
            ? <><span>{isNew ? 'Vanakkam,' : 'Welcome back,'}</span><h1>{first(user.name)}!</h1></>
            : <><span>{isNew ? 'Vanakkam!' : 'Welcome back!'}</span><h1>Welcome to FreshMart</h1></>}
          <p>{isNew ? <>Fresh groceries at your door in <b>10 minutes</b>.</> : 'Good to see you again.'}</p>
        </div>
        <div className="wl-cards">
          <div className="wl-card"><Ic d={PIN} /><div><b>{addr ? `Delivering to ${addr.label || 'Home'}` : 'Add your address'}</b><span>{addr ? addr.line1 : 'You’ll pick it at checkout'}</span></div></div>
          {last && (
            <div className="wl-card"><Ic d={BOX} /><div><b>Last order #{last.order_number} {STATUS[last.status] || last.status}</b>
              <span>{last.items?.reduce((n, i) => n + i.quantity, 0)} items · {rs(last.bill?.total)}</span></div></div>
          )}
          {wallet > 0 && <div className="wl-card"><Ic d={WALLET} /><div><b>FreshMart wallet: {rs(wallet)}</b><span>Use it on your next order</span></div></div>}
          {isNew && <div className="wl-card"><Ic d={TAG} /><div><b>Free delivery above ₹499</b><span>Pay by UPI, card or cash</span></div></div>}
        </div>
        <div className="wl-foot">
          <div className="wl-bar" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label="Opening the store"><span style={{ width: `${p}%` }} /></div>
          <span>{p < 100 ? 'Getting your store ready…' : 'Opening the shop →'}</span>
          <button type="button" className="wl-btn white" onClick={() => navigate('/', { replace: true })}>Start shopping</button>
        </div>
      </div>
    </div>
  )
}

// ---------------- Store admin ----------------
function AdminWelcome({ user }) {
  const navigate = useNavigate()
  const [dash, setDash] = useState(null)
  const [today, setToday] = useState(null)
  const [left, setLeft] = useState(6)
  const [paused, setPaused] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/api/admin/dashboard').then(setDash).catch(() => {})
    const s = new Date(); s.setHours(0, 0, 0, 0)
    const e = new Date(s); e.setDate(e.getDate() + 1)
    api.get(`/api/admin/earnings?date_from=${s.toISOString()}&date_to=${e.toISOString()}&tz=${-s.getTimezoneOffset()}`).then(setToday).catch(() => {})
  }, [])
  useEffect(() => {
    if (paused) return
    if (left <= 0) { navigate('/admin', { replace: true }); return }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [left, paused, navigate])

  const open = dash?.store?.is_open
  const toggle = async () => {
    if (!dash) return
    setBusy(true); setPaused(true)
    try {
      const r = await api.patch('/api/admin/store/availability', { is_open: !open })
      setDash((d) => ({ ...d, store: { ...d.store, is_open: r.is_open } }))
    } catch { /* keep as is */ }
    finally { setBusy(false) }
  }
  const date = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="wl wl-admin">
      <section className="wl-admin-side">
        <div className="wl-brand"><span className="wl-mark">{BAG}</span><div><b>FreshMart</b><small>Store admin</small></div></div>
        <div className="wl-hi">
          <span>{greeting()}</span>
          <h1>{first(user.name)}</h1>
          <p>{dash?.store?.name || 'Your store'}<br />{date}</p>
        </div>
        <div className="wl-store">
          <div><b>{open ? 'Store is open' : 'Store is closed'}</b><span>{open ? 'Customers can order now' : 'Customers can’t see your store'}</span></div>
          <button type="button" role="switch" aria-checked={Boolean(open)} aria-label="Store open" className={`wl-switch ${open ? 'on' : ''}`} onClick={toggle} disabled={!dash || busy}><span /></button>
        </div>
      </section>
      <section className="wl-admin-main">
        <div className="wl-admin-head"><h2>Today at a glance</h2><p>What needs you first.</p></div>
        <div className="wl-glance">
          <button type="button" className={`wl-tile ${dash?.pending_orders ? 'hot' : ''}`} onClick={() => navigate('/admin/orders')}>
            <span>{dash?.pending_orders ? 'NEEDS ACTION' : 'ORDERS'}</span><b>{dash ? dash.pending_orders : '…'}</b><em>new orders waiting</em>
          </button>
          <button type="button" className="wl-tile" onClick={() => navigate('/admin/earnings')}>
            <span>TODAY’S EARNINGS</span><b>{today ? rs(today.total) : '…'}</b>
            <em>{today ? `Online ${rs(today.online.net)} · In-store ${rs(today.store.total)}` : ' '}</em>
          </button>
          <button type="button" className="wl-tile" onClick={() => navigate('/admin/products?low=1')}>
            <span>LOW STOCK</span><b>{dash ? dash.low_stock_count : '…'}</b><em>products running out</em>
          </button>
          <button type="button" className="wl-tile" onClick={() => navigate('/admin/complaints')}>
            <span>RETURNS &amp; COMPLAINTS</span><b>{dash ? dash.open_complaints : '…'}</b><em>open</em>
          </button>
        </div>
        <div className="wl-admin-foot">
          <button type="button" className="wl-btn" onClick={() => navigate('/admin', { replace: true })}>Open dashboard</button>
          <span>{paused ? 'Staying on this page' : `Opening the dashboard in ${left}s…`}</span>
          <button type="button" className="wl-btn ghost" onClick={() => { setPaused((v) => !v); setLeft(6) }}>{paused ? 'Continue' : 'Stay here'}</button>
        </div>
      </section>
    </div>
  )
}

// ---------------- Delivery partner ----------------
const CHECKS = ['Helmet on', 'Delivery bag with me', 'Phone charged & GPS on']

function RiderWelcome({ user }) {
  const navigate = useNavigate()
  const [me, setMe] = useState(null)
  const [earn, setEarn] = useState(null)
  const [done, setDone] = useState([false, false, false])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/delivery/me').then(setMe).catch(() => {})
    api.get('/api/delivery/earnings?days=1').then(setEarn).catch(() => {})
  }, [])

  const all = done.every(Boolean)
  const online = me?.is_online
  const go = async () => {
    if (online) return navigate('/delivery', { replace: true })
    if (!all) return
    setBusy(true); setError('')
    try { await api.patch('/api/delivery/online', { is_online: true }); navigate('/delivery', { replace: true }) }
    catch (e) { setError(e.message); setBusy(false) }
  }
  const v = me?.vehicle || user.vehicle

  return (
    <div className="wl wl-rider">
      <div className="wl-rider-in">
        <div className="wl-rider-top">
          <div className="wl-brand"><span className="wl-mark amber">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18.5" cy="17.5" r="3.5" /><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="15" cy="5" r="1" /><path d="M12 17.5V14l-3-3 4-3 2 3h2" /></svg>
          </span><div><b>FreshMart Delivery</b><small>Partner app</small></div></div>
          <span className={`wl-pill ${online ? 'on' : ''}`}>{online ? 'Online' : 'Offline'}</span>
        </div>
        <div className="wl-hi">
          <span>{greeting()}</span>
          <h1>Ready to ride, {first(user.name)}?</h1>
          <p>{v?.number ? `${v.type ? v.type[0].toUpperCase() + v.type.slice(1) : 'Vehicle'} ${v.number}` : 'Have a safe day'}{user.in_house ? ' · Store staff' : ''}</p>
        </div>
        <div className="wl-stats">
          <div><span>Today</span><b>{earn ? earn.deliveries : '…'}</b><em>deliveries</em></div>
          <div><span>Earned</span><b>{earn ? rs(earn.total) : '…'}</b><em>so far</em></div>
          <div><span>Cash</span><b>{earn ? rs(earn.cash_to_deposit) : '…'}</b><em>to deposit</em></div>
        </div>
        {!online && (
          <div className="wl-checks">
            <b>Before you start</b>
            {CHECKS.map((label, i) => (
              <button key={label} type="button" aria-pressed={done[i]} className={done[i] ? 'on' : ''}
                onClick={() => setDone((d) => d.map((x, j) => (j === i ? !x : x)))}>
                <span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                {label}
              </button>
            ))}
          </div>
        )}
        {error && <p className="au-error" role="alert">{error}</p>}
        <div className="wl-rider-foot">
          <button type="button" className={`wl-btn ${online || all ? 'amber' : 'off'}`} onClick={go} disabled={busy || (!online && !all)}>
            {online ? 'Open delivery app' : busy ? 'Going online…' : all ? 'Go online & start' : 'Tick all 3 to go online'}
          </button>
          {!online && <button type="button" className="wl-link" onClick={() => navigate('/delivery', { replace: true })}>Skip, open the app offline</button>}
        </div>
      </div>
    </div>
  )
}

export default function Welcome() {
  const { user, loading } = useAuth()
  const { state } = useLocation()
  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/partner" replace />
  if (!state?.fresh) return <Navigate to={homeFor(user.role)} replace />
  if (['superadmin', 'picker', 'support'].includes(user.role)) return <Navigate to={homeFor(user.role)} replace />
  if (user.role === 'admin') return <AdminWelcome user={user} />
  if (user.role === 'delivery') return <RiderWelcome user={user} />
  return <CustomerWelcome user={user} isNew={Boolean(state.isNew)} />
}
