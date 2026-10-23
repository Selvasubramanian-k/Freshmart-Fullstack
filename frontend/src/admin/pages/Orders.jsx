import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bike, ClipboardList, Download, RefreshCw, Search, MapPin, Phone, CreditCard, Clock } from 'lucide-react'
import { api } from '../../shared/api/client.js'
import { resolveImage } from '../../shared/utils/images.js'
import { Empty, ErrorNote, Modal, PageHead, StatusBadge } from '../components/ui.jsx'
import OrderJourney from '../components/OrderJourney.jsx'
import { actionsFor, ORDER_STATUS, PAY_NAMES, SLOT_NAMES, fmtDateTime, rs } from '../utils/format.js'

const TABS = [
  { id: 'active',    label: 'Active',    match: (s) => ['placed', 'confirmed', 'packed', 'out_for_delivery'].includes(s) },
  { id: 'placed',    label: 'New',       match: (s) => s === 'placed' },
  { id: 'delivered', label: 'Delivered', match: (s) => s === 'delivered' },
  { id: 'returns',   label: 'Returns',   match: (s) => ['return_requested', 'returned'].includes(s) },
  { id: 'cancelled', label: 'Cancelled', match: (s) => s === 'cancelled' },
  { id: 'all',       label: 'All',       match: () => true },
]

// Store's own delivery staff: send the order with one of them (live tracking via the delivery app)
function SendWithStaff({ order, onUpdated }) {
  const [riders, setRiders] = useState(null)
  const [pick, setPick]     = useState('')
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState('')
  useEffect(() => { api.get('/api/admin/riders').then((r) => { setRiders(r); setPick(r.find((x) => !x.busy)?.id || '') }).catch(() => setRiders([])) }, [])
  if (!riders) return null
  if (riders.length === 0) return <p className="ad-od-note">No rider yet? Add your own delivery staff under <b>Staff</b> (role: Delivery) to deliver it yourselves with live tracking.</p>
  const free = riders.filter((r) => !r.busy)
  const send = async () => {
    setBusy(true); setError('')
    try { onUpdated(await api.post(`/api/admin/orders/${order.id}/assign`, { rider_id: pick })) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="ad-send-staff">
      <p className="ad-od-h">Or send with our staff</p>
      {free.length === 0 ? <p className="ad-muted ad-small">All your delivery staff are out on deliveries.</p> : (
        <div className="ad-send-row">
          <select className="ad-input" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Delivery staff">
            {free.map((r) => <option key={r.id} value={r.id}>{r.name}{r.is_online ? ' · online' : ''}</option>)}
          </select>
          <button className="ad-btn" disabled={busy || !pick} onClick={send}>{busy ? 'Sending…' : 'Send'}</button>
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
    </div>
  )
}

// ---------- date range (browser's local days; week starts Monday) ----------
const RANGES = [
  { id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }, { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' }, { id: 'all', label: 'All time' }, { id: 'custom', label: 'Pick dates' },
]
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const nice = (d, opt = { weekday: 'short', day: 'numeric', month: 'short' }) => d.toLocaleDateString('en-IN', opt)
function rangeBounds(id, from, to) {
  const today = dayStart(new Date())
  if (id === 'today') return { start: today, end: addDays(today, 1), text: `Today · ${nice(today)}` }
  if (id === 'yesterday') { const y = addDays(today, -1); return { start: y, end: today, text: `Yesterday · ${nice(y)}` } }
  if (id === 'week') {
    const mon = addDays(today, -((today.getDay() + 6) % 7))
    return { start: mon, end: addDays(today, 1), text: `This week · ${nice(mon)} – ${nice(today)}` }
  }
  if (id === 'month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    return { start: first, end: addDays(today, 1), text: `This month · ${nice(first, { day: 'numeric', month: 'short' })} – ${nice(today, { day: 'numeric', month: 'short' })}` }
  }
  if (id === 'custom' && from && to) {
    const a = new Date(`${from}T00:00`), b = new Date(`${to}T00:00`)
    const [s, e] = a <= b ? [a, b] : [b, a]
    return { start: s, end: addDays(e, 1), text: `${nice(s, { day: 'numeric', month: 'short', year: 'numeric' })} – ${nice(e, { day: 'numeric', month: 'short', year: 'numeric' })}` }
  }
  return { start: null, end: null, text: 'All orders' }
}

function downloadCsv(rows, name) {
  const head = ['Order', 'Placed', 'Customer', 'Phone', 'Items', 'Item value', 'Delivery fee', 'Total', 'Payment', 'Payment status', 'Status']
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const lines = rows.map((o) => [o.order_number, fmtDateTime(o.created_at), o.customer_name, o.customer_phone, o.items.reduce((n, i) => n + i.quantity, 0),
    o.bill.subtotal, o.bill.delivery_fee, o.bill.total, PAY_NAMES[o.payment.method] || o.payment.method, o.payment.status, ORDER_STATUS[o.status]?.label || o.status].map(esc).join(','))
  const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function OrderDetail({ order, onClose, onUpdated }) {
  const [busy, setBusy]   = useState('')
  const [error, setError] = useState('')
  const actions = actionsFor(order)
  const rider = order.partner

  const move = async (to) => {
    const act = actions.find(a => a.to === to)
    if (act?.confirm && !window.confirm(act.confirm)) return
    let note = null
    if (to === 'cancelled') {
      note = window.prompt('Reason for cancelling (shown to the customer):', 'Item not available')
      if (note === null) return
    }
    setBusy(to); setError('')
    try { onUpdated(await api.patch(`/api/admin/orders/${order.id}/status`, { status: to, note })) }
    catch (e) { setError(e.message) }
    finally { setBusy('') }
  }

  const b = order.bill
  return (
    <Modal title={`Order #${order.order_number}`} onClose={onClose} wide>
      <div className="ad-od">
        <div className="ad-od-top">
          <StatusBadge status={order.status} />
          <span className="ad-muted">Placed {fmtDateTime(order.created_at)}</span>
        </div>

        <div className="ad-od-grid">
          <div className="ad-od-box">
            <p className="ad-od-h">Customer</p>
            <b>{order.customer_name}</b>
            {order.customer_phone && <a className="ad-od-line" href={`tel:+91${order.customer_phone}`}><Phone size={14} /> +91 {order.customer_phone}</a>}
            <p className="ad-od-line"><MapPin size={14} /> {order.address.label} · {order.address.text}</p>
            {order.instructions?.length > 0 && <p className="ad-od-note">{order.instructions.join(' · ')}</p>}
          </div>
          <div className="ad-od-box">
            <p className="ad-od-h">Delivery & payment</p>
            <p className="ad-od-line"><Clock size={14} /> {SLOT_NAMES[order.slot] || order.slot}</p>
            <p className="ad-od-line"><CreditCard size={14} /> {PAY_NAMES[order.payment.method]} · <b className={`ad-pay ${order.payment.status}`}>{order.payment.status}</b></p>
            {order.payment.transaction_id && <p className="ad-muted ad-small mono">{order.payment.transaction_id}</p>}
          </div>
          <div className="ad-od-box">
            <p className="ad-od-h">Delivery partner</p>
            {rider ? (
              <>
                <b>{rider.name}{rider.in_house && <span className="ad-ex-tag">OUR STAFF</span>}</b>
                {rider.phone && <a className="ad-od-line" href={`tel:+91${rider.phone}`}><Phone size={14} /> +91 {rider.phone}</a>}
                <p className="ad-od-line"><Bike size={14} /> {rider.vehicle?.number || rider.vehicle?.type || 'Rider'}
                  {' · '}{rider.picked_up_at ? 'Picked up' : rider.reached_store_at ? 'At your store' : 'Coming to your store'}</p>
                {order.rating && <p className="ad-od-line"><span className="ad-stars" aria-label={`${order.rating.stars} out of 5 stars`}>{'★'.repeat(order.rating.stars)}{'☆'.repeat(5 - order.rating.stars)}</span> customer rating</p>}
                {!rider.picked_up_at && order.status !== 'cancelled' && <p className="ad-od-note">Pack the order; the rider marks pickup and delivery from the rider app.</p>}
              </>
            ) : ['confirmed', 'packed'].includes(order.status) ? (
              <>
                <p className="ad-muted">Looking for a nearby rider… Riders who are online see this order now.</p>
                <SendWithStaff order={order} onUpdated={onUpdated} />
              </>
            ) : (
              <p className="ad-muted">{order.status === 'placed' ? 'Accept the order to send it to riders.' : 'No rider assigned.'}</p>
            )}
          </div>
        </div>

        <div className="ad-od-items">
          {order.items.map(it => (
            <div className="ad-od-item" key={it.pid}>
              <span className="ad-thumb">{resolveImage(it.image_url) && <img src={resolveImage(it.image_url)} alt="" />}</span>
              <div className="grow"><b>{it.name}</b><span className="ad-muted">{it.unit} · {rs(it.price)} × {it.quantity}</span></div>
              <b>{rs(it.line_total)}</b>
            </div>
          ))}
          <div className="ad-od-bill">
            <span>Items</span><span>{rs(b.subtotal)}</span>
            <span>Delivery fee</span><span>{rs(b.delivery_fee)}</span>
            {b.tip > 0 && <><span>Tip (delivery partner)</span><span>{rs(b.tip)}</span></>}
            {b.coupon_discount > 0 && <><span>Coupon {order.coupon_code}</span><span>−{rs(b.coupon_discount)}</span></>}
            {b.payment_discount > 0 && <><span>Payment offer</span><span>−{rs(b.payment_discount)}</span></>}
            <b>Customer pays</b><b>{rs(b.total)}</b>
          </div>
        </div>

        <OrderJourney order={order} />

        <ErrorNote>{error}</ErrorNote>
        {actions.length > 0 && (
          <div className="ad-form-actions">
            {actions.map(a => (
              <button key={a.to} className={`ad-btn ${a.danger ? 'danger ghost' : a.ghost ? 'ghost' : ''}`} disabled={Boolean(busy)} onClick={() => move(a.to)}>
                {busy === a.to ? 'Updating…' : a.label}
              </button>
            ))}
          </div>
        )}
        {order.status === 'return_requested' && <p className="ad-muted">Decide this return from <b>Returns & Complaints</b>.</p>}
      </div>
    </Modal>
  )
}

export default function Orders() {
  const [params, setParams] = useSearchParams()
  const [orders, setOrders] = useState(null)
  const [error, setError]   = useState('')
  const [tab, setTab]       = useState('active')
  const [q, setQ]           = useState('')
  const [range, setRange]   = useState('week')
  const [from, setFrom]     = useState(() => ymd(addDays(new Date(), -7)))
  const [to, setTo]         = useState(() => ymd(new Date()))
  const [olderActive, setOlderActive] = useState(0)
  const openId              = params.get('open')
  const bounds = useMemo(() => rangeBounds(range, from, to), [range, from, to])

  const load = useCallback(() => {
    const qs = bounds.start ? `?date_from=${bounds.start.toISOString()}&date_to=${bounds.end.toISOString()}` : ''
    api.get(`/api/admin/orders${qs}`).then(setOrders).catch(e => setError(e.message))
    // orders still being handled but placed before this range -> don't let them hide
    if (bounds.start) {
      api.get('/api/admin/orders?active=true')
        .then((xs) => setOlderActive(xs.filter((o) => new Date(o.created_at.endsWith('Z') || o.created_at.includes('+') ? o.created_at : `${o.created_at}Z`) < bounds.start).length))
        .catch(() => {})
    }
  }, [bounds])
  // New orders / rider pickup -> list auto update (every 8s + when the tab gets focus)
  useEffect(() => {
    load()
    const t = setInterval(load, 8000)
    window.addEventListener('focus', load)
    return () => { clearInterval(t); window.removeEventListener('focus', load) }
  }, [load])

  const counts = useMemo(() => Object.fromEntries(TABS.map(t => [t.id, (orders || []).filter(o => t.match(o.status)).length])), [orders])
  const list = useMemo(() => {
    const t = TABS.find(x => x.id === tab)
    const needle = q.trim().toLowerCase()
    return (orders || []).filter(o => t.match(o.status) &&
      (!needle || o.order_number.toLowerCase().includes(needle) || o.customer_name.toLowerCase().includes(needle)))
  }, [orders, tab, q])

  // summary for the chosen dates (sales = item value of delivered orders)
  const summary = useMemo(() => {
    const xs = orders || []
    const del = xs.filter((o) => o.status === 'delivered' && !o.is_exchange)  // free exchanges aren't sales
    const sales = del.reduce((a, o) => a + (o.bill.subtotal || 0), 0)
    return { count: xs.length, delivered: del.length, sales, avg: del.length ? sales / del.length : 0, cancelled: xs.filter((o) => o.status === 'cancelled').length }
  }, [orders])

  const open = orders?.find(o => o.id === openId)
  const setOpen = (id) => setParams(id ? { open: id } : {})
  const onUpdated = (o) => setOrders(xs => xs.map(x => x.id === o.id ? o : x))

  return (
    <>
      <PageHead title="Orders" sub={bounds.text}>
        <button className="ad-btn ghost" disabled={!list.length} onClick={() => downloadCsv(list, `freshmart-orders-${bounds.start ? ymd(bounds.start) : 'all'}.csv`)}><Download size={16} /> Download CSV</button>
        <button className="ad-btn ghost" onClick={load}><RefreshCw size={16} /> Refresh</button>
      </PageHead>

      <div className="ad-range" role="group" aria-label="Date range">
        {RANGES.map((r) => (
          <button key={r.id} type="button" className={`ad-chip ${range === r.id ? 'on' : ''}`} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>
        ))}
        {range === 'custom' && (
          <div className="ad-range-dates">
            <label>From <input type="date" className="ad-input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
            <label>To <input type="date" className="ad-input" value={to} min={from} max={ymd(new Date())} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
        )}
      </div>

      <div className="ad-sum">
        <div className="ad-sum-card"><span>Sales</span><b className="good">{rs(summary.sales)}</b><small>item value · delivered orders</small></div>
        <div className="ad-sum-card"><span>Orders</span><b>{summary.count}</b><small>{summary.delivered} delivered</small></div>
        <div className="ad-sum-card"><span>Average order</span><b>{rs(summary.avg)}</b><small>per delivered order</small></div>
        <div className="ad-sum-card"><span>Cancelled</span><b className="bad">{summary.cancelled}</b><small>orders</small></div>
      </div>

      {bounds.start && olderActive > 0 && (
        <p className="ad-older">
          {olderActive} active order{olderActive > 1 ? 's are' : ' is'} from before this range.
          <button type="button" onClick={() => { setRange('all'); setTab('active') }}>Show {olderActive > 1 ? 'them' : 'it'}</button>
        </p>
      )}

      <div className="ad-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`ad-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label} <span className="ad-tab-n">{counts[t.id]}</span>
          </button>
        ))}
      </div>
      <div className="ad-toolbar">
        <div className="ad-search"><Search size={16} /><input placeholder="Search order no. or customer" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      <ErrorNote>{error}</ErrorNote>
      {!orders ? <p className="ad-muted">Loading orders…</p> : list.length === 0 ? (
        <Empty icon={ClipboardList} title="No orders here" text="No orders in this state for these dates. Try another date range." />
      ) : (
        <div className="ad-card flush">
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Placed</th><th /></tr></thead>
              <tbody>
                {list.map(o => {
                  const next = o.status === 'packed' && !o.partner ? { label: 'Waiting for rider' } : actionsFor(o)[0]
                  return (
                    <tr key={o.id} className="clickable" onClick={() => setOpen(o.id)}>
                      <td className="mono">#{o.order_number}{o.is_exchange && <span className="ad-ex-tag">EXCHANGE</span>}</td>
                      <td>{o.customer_name}</td>
                      <td>{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                      <td><b>{rs(o.bill.total)}</b></td>
                      <td><span className={`ad-pay ${o.payment.status}`}>{o.payment.method === 'cod' ? 'COD' : PAY_NAMES[o.payment.method]} · {o.payment.status}</span></td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="ad-muted">{fmtDateTime(o.created_at)}</td>
                      <td>{next && <span className="ad-next">{next.label} →</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && <OrderDetail order={open} onClose={() => setOpen(null)} onUpdated={onUpdated} />}
    </>
  )
}
