import { useCallback, useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Navbar      from './components/Navbar.jsx'
import CartDrawer  from './components/CartDrawer.jsx'
import Home        from './pages/Home.jsx'
import Checkout    from './pages/Checkout.jsx'
import Success     from './pages/Success.jsx'
import Shops       from './pages/Shops.jsx'
import Offers      from './pages/Offers.jsx'
import Contact     from './pages/Contact.jsx'
import Account     from './pages/Account.jsx'
import Track       from './pages/Track.jsx'
import Issue from './pages/Issue.jsx'
import CancelOrder from './pages/CancelOrder.jsx'
import { getProduct, loadCatalog } from './data/products.js'
import { loadOrders, placeOrder } from './utils/orderHistory.js'
import { useAuth } from '../shared/context/AuthContext.jsx'
import HomeSkeleton from './components/HomeSkeleton.jsx'
import './customer.css'

const CART_KEY = 'freshmart_cart'
const LIVE = ['placed', 'confirmed', 'packed', 'out_for_delivery']

function statusMessage(o) {
  const rider = o.partner?.name?.split(' ')[0]
  switch (o.status) {
    case 'confirmed': return `${o.store_name} accepted your order #${o.order_number}`
    case 'packed': return `Order #${o.order_number} is packed`
    case 'out_for_delivery': return `${rider || 'Your rider'} picked up your order and is on the way`
    case 'delivered': return `Order #${o.order_number} delivered. Enjoy!`
    case 'cancelled': return `Order #${o.order_number} was cancelled`
    default: return ''
  }
}
function askNotifyPermission() {
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission() } catch { /* not supported */ }
}
function notify(text, orderId) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted' || document.visibilityState === 'visible') return
    const n = new Notification('FreshMart', { body: text, tag: `order-${orderId}` })
    n.onclick = () => { window.focus(); window.location.assign(`/track/${orderId}`) }
  } catch { /* not supported */ }
}
const readCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || {} } catch { return {} } }

export default function CustomerApp() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [cart, setCart]           = useState(readCart)
  const [drawerOpen, setDrawer]   = useState(false)
  const [activeCat, setActiveCat] = useState('all')
  const [searchQuery, setSearch]  = useState('')
  const [orders, setOrders]       = useState([])   // previous orders (backend)
  const [ready, setReady]         = useState(false)
  const [loadError, setLoadError] = useState('')
  const [catalogVersion, setCatalogVersion] = useState(0)

  // Catalog + order history backend la irundhu load
  const refresh = useCallback(async () => {
    const [, history] = await Promise.all([loadCatalog(), loadOrders()])
    setOrders(history)
    setCatalogVersion(v => v + 1)
    // stock theernthu pona / remove aana products ah cart la irundhu edukkum
    setCart(c => {
      const next = {}
      for (const [id, q] of Object.entries(c)) {
        const p = getProduct(id)
        if (p && p.stock > 0) next[id] = Math.min(q, p.stock)
      }
      return next
    })
  }, [])

  useEffect(() => {
    // async fetch; state updates happen after the network call, not synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
      .then(() => setReady(true))
      .catch(err => setLoadError(err.message))
  }, [refresh])

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)) } catch { /* storage blocked */ }
  }, [cart])

  // Live orders irundha 5s ku oru thadava status check pannuvom (tab ku thirumba vandhalum udane).
  // Status maarina (eg. rider picked up) toast + browser notification.
  const lastStatus = useRef(null)
  const [toast, setToast] = useState(null)
  const hasLive = orders.some(o => LIVE.includes(o.raw.status))
  useEffect(() => {
    const prev = lastStatus.current
    const now = Object.fromEntries(orders.map(o => [o.id, o.raw.status]))
    lastStatus.current = now
    if (!prev) return
    for (const o of orders) {
      const was = prev[o.id]
      if (!was || was === o.raw.status) continue
      if (o.raw.status === 'cancelled' && o.raw.cancel?.by === 'customer') continue  // they did it themselves
      const msg = statusMessage(o.raw)
      if (!msg) continue
      setToast({ id: o.id, text: msg })   // eslint-disable-line react-hooks/set-state-in-effect
      notify(msg, o.id)
    }
  }, [orders])
  useEffect(() => {
    const sync = () => { loadOrders().then(setOrders).catch(() => {}) }
    const onShow = () => { if (document.visibilityState === 'visible') sync() }
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', onShow)
    const t = hasLive ? setInterval(sync, 5000) : null   // live order: every 5s
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [hasLive])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  // stock ku mela add panna mudiyaadhu
  const canAdd = (id, current) => {
    const p = getProduct(id)
    return p && current < p.stock
  }
  const addToCart  = (p)  => setCart(c => (canAdd(p.id, c[p.id] || 0) ? { ...c, [p.id]: (c[p.id] || 0) + 1 } : c))
  const increment  = (id) => setCart(c => (canAdd(id, c[id] || 0) ? { ...c, [id]: (c[id] || 0) + 1 } : c))
  const decrement  = (id) => setCart(c => {
    const qty = (c[id] || 0) - 1
    if (qty <= 0) { const n = { ...c }; delete n[id]; return n }
    return { ...c, [id]: qty }
  })
  const removeItem = (id) => setCart(c => { const n = { ...c }; delete n[id]; return n })
  const clearCart  = ()   => setCart({})

  // Order place -> backend. Error vandha CheckoutPage la kaattum (throw).
  const handlePlaceOrder = async (payload) => {
    const result = await placeOrder(payload)
    askNotifyPermission()
    clearCart()
    refresh().catch(() => {})
    return result
  }

  const handleLogout = () => {
    clearCart()
    setDrawer(false)
    logout()
    navigate('/login')
  }

  if (loadError) {
    return (
      <div className="fm-loader">
        <p><b>Couldn't load the store.</b></p>
        <p>{loadError}</p>
        <button className="ck-btn" onClick={() => window.location.reload()}>Try again</button>
      </div>
    )
  }
  if (!ready) return <HomeSkeleton />

  const cartProps = { cart, addToCart, increment, decrement, removeItem }

  return (
    <div className="app">
      <Navbar
        activeCat={activeCat}
        onCategory={setActiveCat}
        onCartClick={() => setDrawer(true)}
        cartCount={Object.values(cart).reduce((s, q) => s + q, 0)}
        onSearch={setSearch}
        user={user}
        onLogout={handleLogout}
      />

      <Routes>
        <Route path="/" element={
          <div className="layout">
            <main className="main-content" key={catalogVersion}>
              <Home
                activeCat={activeCat}
                onCategory={setActiveCat}
                searchQuery={searchQuery}
                orders={orders}
                user={user}
                {...cartProps}
              />
            </main>
          </div>
        }/>
        <Route path="/account" element={
          <Account user={user} orders={orders} increment={increment} onLogout={handleLogout}
            onOpenCart={() => setDrawer(true)} onRefresh={refresh} />
        }/>
        <Route path="/checkout" element={<Checkout cart={cart} user={user} onPlaceOrder={handlePlaceOrder} increment={increment} decrement={decrement} />}/>
        <Route path="/success"  element={<Success />} />
        <Route path="/shops"    element={<Shops />} />
        <Route path="/offers"   element={<Offers {...cartProps} onBrowse={setActiveCat} />} />
        <Route path="/contact"  element={<Contact />} />
        <Route path="/track/:orderId" element={<Track />} />
        <Route path="/issue/:orderId" element={<Issue />} />
        <Route path="/cancel/:orderId" element={<CancelOrder increment={increment} onOpenCart={() => setDrawer(true)} onRefresh={refresh} />} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>

      {toast && (
        <div className="fm-toast" role="status">
          <span>{toast.text}</span>
          <button onClick={() => { navigate(`/track/${toast.id}`); setToast(null) }}>Track</button>
        </div>
      )}

      <CartDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawer(false)}
        onOpen={() => setDrawer(true)}
        orders={orders}
        {...cartProps}
      />
    </div>
  )
}
