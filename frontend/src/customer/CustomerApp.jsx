import { useCallback, useEffect, useState } from 'react'
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
import { getProduct, loadCatalog } from './data/products.js'
import { loadOrders, placeOrder } from './utils/orderHistory.js'
import { useAuth } from '../shared/context/AuthContext.jsx'
import FullPageLoader from '../shared/components/FullPageLoader.jsx'
import './customer.css'

const CART_KEY = 'freshmart_cart'
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
  if (!ready) return <FullPageLoader label="Loading fresh products…" />

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
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>

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
