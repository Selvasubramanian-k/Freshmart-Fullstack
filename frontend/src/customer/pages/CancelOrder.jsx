// Cancel order page: why are you cancelling + optional message → cancel → red "Order cancelled" screen.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CreditCard } from 'lucide-react'
import { api } from '../../shared/api/client.js'
import { resolveImage } from '../../shared/utils/images.js'
import { getProduct } from '../data/products.js'
import ProductImage from '../components/ProductImage.jsx'
import CancelledScreen from '../components/CancelledScreen.jsx'

const REASONS = [
  { id: 'mistake', label: 'Ordered by mistake' },
  { id: 'change', label: 'Want to change items', tip: 'Want to add something? Order the extra items now and keep this one.', btn: 'Keep & add items', to: '/' },
  { id: 'address', label: 'Wrong delivery address', tip: 'The store may be able to change the address for you.', btn: 'Contact store', to: '/contact' },
  { id: 'late', label: 'It’s taking too long', tip: 'Most orders are accepted in a couple of minutes. You can keep waiting and track it live.', btn: 'Keep waiting', to: 'track' },
  { id: 'other', label: 'Something else' },
]
const CANCELLABLE = ['placed', 'confirmed']
const rs = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const imgOf = (it) => getProduct(it.pid)?.img || resolveImage(it.image_url)

export default function CancelOrder({ increment, onOpenCart, onRefresh }) {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)   // the cancelled order

  useEffect(() => {
    api.get(`/api/customer/orders/${orderId}`).then(setOrder).catch((e) => setError(e.message))
  }, [orderId])

  const back = () => navigate(`/track/${orderId}`)
  const picked = REASONS.find((r) => r.id === reason)

  const submit = async () => {
    if (!picked) return
    setBusy(true); setError('')
    try {
      const o = await api.post(`/api/customer/orders/${orderId}/cancel`, { reason: picked.label, message: message.trim() || null })
      setDone(o)
      onRefresh?.()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  if (done) {
    return (
      <CancelledScreen
        order={done}
        reason={picked?.label}
        onDone={() => navigate('/', { replace: true })}
        onOrderAgain={() => {
          done.items.forEach((it) => { for (let i = 0; i < it.quantity; i++) increment?.(it.pid) })
          navigate('/', { replace: true })
          onOpenCart?.()
        }}
      />
    )
  }

  if (!order) {
    return <div className="cx-page"><div className="cx-wrap">{error ? <p className="cx-err">{error}</p> : <p className="cx-muted">Loading…</p>}</div></div>
  }

  const items = order.items.reduce((n, i) => n + i.quantity, 0)
  const paid = order.payment.method !== 'cod' && order.payment.status === 'paid'
  const head = (
    <div className="cx-head">
      <button type="button" className="cx-back" aria-label="Back" onClick={back}><ArrowLeft size={20} /></button>
      <div><b>Cancel order</b><span>#{order.order_number} · {order.store_name}</span></div>
    </div>
  )

  if (!CANCELLABLE.includes(order.status)) {
    return (
      <div className="cx-page"><div className="cx-wrap">
        {head}
        <section className="cx-card-w">
          <b className="cx-big">{order.status === 'cancelled' ? 'This order is already cancelled' : 'This order can’t be cancelled now'}</b>
          <p className="cx-muted">{order.status === 'cancelled' ? 'Nothing more to do here.' : 'The store has already packed it. If something is wrong, you can report it after delivery or contact the store.'}</p>
          <div className="cx-actions">
            <button type="button" className="cx-btn ghost" onClick={() => navigate('/contact')}>Contact store</button>
            <button type="button" className="cx-btn" onClick={back}>Track order</button>
          </div>
        </section>
      </div></div>
    )
  }

  return (
    <div className="cx-page">
      <div className="cx-wrap">
        {head}

        <section className="cx-card-w cx-order">
          <div className="cx-thumbs">
            {order.items.slice(0, 3).map((it) => <span key={it.pid}><ProductImage product={{ name: it.name, img: imgOf(it) }} /></span>)}
          </div>
          <div className="cx-order-txt">
            <b>{order.items.length === 1 ? `${order.items[0].name} ${order.items[0].unit || ''} × ${order.items[0].quantity}` : `${items} items`}</b>
            <span>{order.status === 'placed' ? 'Waiting for the store to accept' : 'Accepted, not packed yet'}</span>
          </div>
          <b>{rs(order.bill.total)}</b>
        </section>

        <section className="cx-card-w">
          <b className="cx-big">Why are you cancelling?</b>
          <div className="cx-reasons" role="radiogroup" aria-label="Reason">
            {REASONS.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={reason === r.id} className={`cx-reason ${reason === r.id ? 'on' : ''}`} onClick={() => setReason(r.id)}>
                <span className="cx-radio"><span /></span>{r.label}
              </button>
            ))}
          </div>
          <label className="cx-label" htmlFor="cx-msg">Anything you want to tell the store? <span>(optional)</span></label>
          <textarea id="cx-msg" className="cx-input" rows={3} maxLength={300} value={message}
            placeholder="e.g. I’ll order again in the evening" onChange={(e) => setMessage(e.target.value)} />
        </section>

        {picked?.tip && (
          <section className="cx-tip">
            <span>{picked.tip}</span>
            <button type="button" onClick={() => navigate(picked.to === 'track' ? `/track/${orderId}` : picked.to)}>{picked.btn}</button>
          </section>
        )}

        <section className="cx-refund">
          <CreditCard size={20} />
          <span><b>Refund:</b> {paid ? `${rs(order.bill.total)} goes back to your account in 3–5 working days.` : 'this is a Cash on Delivery order, so you haven’t paid anything.'}</span>
        </section>

        {error && <p className="cx-err">{error}</p>}

        <div className="cx-bar-bottom">
          <button type="button" className="cx-btn ghost" onClick={back}>Keep my order</button>
          <button type="button" className="cx-btn danger" disabled={!picked || busy} onClick={submit}>{busy ? 'Cancelling…' : 'Cancel order'}</button>
        </div>
      </div>
    </div>
  )
}
