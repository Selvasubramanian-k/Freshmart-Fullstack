import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { as, publicGet } from './demoApi.js'
import './demo.css'

// ─────────────────────────────────────────────────────────────
//  /demo  (development only): Customer | Store admin | Rider on ONE screen.
//  Each frame has its own login (window.name -> separate token key),
//  so no Incognito / second browser needed. Top bar tells you the next step.
// ─────────────────────────────────────────────────────────────
const FRAMES = [
  { role: 'customer', title: 'Customer', w: 390, h: 820 },
  { role: 'admin',    title: 'Store admin', w: 1100, h: 820 },
  { role: 'delivery', title: 'Delivery partner', w: 390, h: 820 },
]
const GAP = 20
const DROP = { label: 'Home', text: '7, Lake View Road, Velachery, Chennai 600042', lat: 13.0418, lng: 80.2341 }

function nextStep(o, rider) {
  if (!o) return { who: 'you', text: 'Click "Place test order", or add items and order from the Customer phone.' }
  const p = o.partner
  switch (o.status) {
    case 'placed': return { who: 'admin', text: 'Store admin: open the new order and click "Accept order".' }
    case 'confirmed':
    case 'packed':
      if (!p) return rider?.is_online
        ? { who: 'delivery', text: 'Rider: click "Accept delivery" on the new order card.' }
        : { who: 'delivery', text: 'Rider: turn the switch to "Online".' }
      if (!p.reached_store_at) return { who: 'delivery', text: 'Rider: click "Demo drive" and watch the Customer map, then "I\'ve reached the store".' }
      if (o.status === 'confirmed') return { who: 'admin', text: 'Store admin: open the order and click "Mark packed".' }
      return { who: 'delivery', text: 'Rider: slide "Picked up order" to the right.' }
    case 'out_for_delivery':
      if (!p) return { who: 'admin', text: 'Store staff is delivering (no rider). Store admin: "Mark delivered".' }
      return { who: 'delivery', text: `Rider: "Demo drive" → "I've arrived" → enter code ${o.code || '----'} → slide "Delivered".` }
    case 'delivered': return { who: 'done', text: 'Delivered! Check rider Earnings, or place another test order.' }
    case 'cancelled': return { who: 'you', text: 'Order cancelled. Place another test order.' }
    default: return { who: 'you', text: `Status: ${o.status}` }
  }
}

export default function DemoView() {
  const frames = useRef({})
  const [scale, setScale] = useState(0.6)
  const [order, setOrder] = useState(null)
  const [rider, setRider] = useState(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const followId = useRef(null)

  // fit all three frames on the screen
  useEffect(() => {
    const fit = () => {
      const totalW = FRAMES.reduce((s, f) => s + f.w, 0) + GAP * (FRAMES.length - 1)
      setScale(Math.min(1, (window.innerWidth - 32) / totalW, (window.innerHeight - 150) / 850))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  const poll = useCallback(async () => {
    try {
      const [orders, me] = await Promise.all([as('admin', 'GET', '/api/admin/orders'), as('delivery', 'GET', '/api/delivery/me')])
      setRider(me)
      let o = followId.current && orders.find((x) => x.id === followId.current)
      if (!o) o = orders.find((x) => ['placed', 'confirmed', 'packed', 'out_for_delivery'].includes(x.status)) || null
      if (o && o.status === 'out_for_delivery') {
        const t = await as('customer', 'GET', `/api/customer/orders/${o.id}/track`).catch(() => null)
        o = { ...o, code: t?.delivery_code }
      }
      if (o) followId.current = o.id
      setOrder(o)
      setMsg('')
    } catch (e) {
      setMsg(`${e.message}. Is the backend running and did you run python seed.py?`)
    }
  }, [])

  useEffect(() => {
    poll()
    const t = setInterval(poll, 3000)
    return () => clearInterval(t)
  }, [poll])

  const goto = (role, path) => { const f = frames.current[role]; if (f) f.src = `/demo/as/${role}?next=${encodeURIComponent(path)}` }
  const reloadAll = () => FRAMES.forEach(({ role }) => { const f = frames.current[role]; if (f) f.src = `/demo/as/${role}` })

  const run = (label, fn) => async () => {
    setBusy(label); setMsg('')
    try { await fn() } catch (e) { setMsg(e.message) } finally { setBusy(''); poll() }
  }

  const placeOrder = run('order', async () => {
    const products = await publicGet('/api/products')
    const pick = products.filter((p) => p.stock > 1).slice(0, 2)
    if (!pick.length) throw new Error('No products in stock. Add stock from Store admin → Products.')
    const res = await as('customer', 'POST', '/api/customer/orders', {
      items: pick.map((p) => ({ pid: p.pid, quantity: 1 })), address: DROP, tip: 20, payment_method: 'cod',
    })
    const o = res.orders[0]
    followId.current = o.id
    goto('customer', `/track/${o.id}`)
    goto('admin', `/admin/orders?open=${o.id}`)
  })

  const resetRider = run('reset', async () => {
    const me = await as('delivery', 'GET', '/api/delivery/me')
    if (me.active_order_id) {
      const t = await as('customer', 'GET', `/api/customer/orders/${me.active_order_id}/track`).catch(() => null)
      if (t?.status === 'out_for_delivery') await as('delivery', 'POST', '/api/delivery/tasks/current/deliver', { code: t.delivery_code, cash_collected: true })
      else await as('admin', 'PATCH', `/api/admin/orders/${me.active_order_id}/status`, { status: 'cancelled', note: 'Demo reset' })
    }
    followId.current = null
    reloadAll()
  })

  const step = nextStep(order, rider)

  return (
    <div className="dm-page">
      <header className="dm-bar">
        <div className="dm-brand"><b>FreshMart</b> demo view</div>
        <div className={`dm-step ${step.who}`} role="status">
          <span>{step.who === 'done' ? 'Done' : 'Next'}</span>
          <p>{step.text}</p>
        </div>
        <div className="dm-actions">
          <button onClick={placeOrder} disabled={Boolean(busy)}>{busy === 'order' ? 'Placing…' : 'Place test order'}</button>
          <button className="ghost" onClick={resetRider} disabled={Boolean(busy)}>Reset rider</button>
          <button className="ghost" onClick={reloadAll}>Reload all</button>
          <Link className="ghost" to="/login">Exit</Link>
        </div>
      </header>
      {msg && <p className="dm-msg">{msg}</p>}
      {order && (
        <p className="dm-order">
          Following order <b>#{order.order_number}</b> · {order.status.replaceAll('_', ' ')}
          {order.partner ? ` · rider ${order.partner.name}` : ''}{rider ? ` · rider is ${rider.is_online ? 'online' : 'offline'}` : ''}
        </p>
      )}

      <main className="dm-stage">
        {FRAMES.map((f) => (
          <section key={f.role} className={`dm-col ${step.who === f.role ? 'hot' : ''}`} style={{ width: f.w * scale }}>
            <h2>{f.title}{step.who === f.role && <em>your turn</em>}</h2>
            <div className={`dm-device ${f.w < 500 ? 'phone' : 'desk'}`} style={{ width: f.w * scale, height: f.h * scale }}>
              <iframe
                ref={(el) => { frames.current[f.role] = el }}
                name={`fm-demo-${f.role}`}
                title={`${f.title} app`}
                src={`/demo/as/${f.role}`}
                allow="geolocation"
                style={{ width: f.w, height: f.h, transform: `scale(${scale})` }}
              />
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
