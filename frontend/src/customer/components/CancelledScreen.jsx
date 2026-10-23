import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
//  "Order cancelled" full screen (red). Same idea as the delivered
//  screen: 5 seconds, then home. "Order again" puts the items back in the cart.
// ─────────────────────────────────────────────────────────────
const SECONDS = 5
const rs = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const toDate = (iso) => (iso ? new Date(/Z$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`) : new Date())

export default function CancelledScreen({ order, reason, onDone, onOrderAgain }) {
  const [left, setLeft] = useState(SECONDS)
  const leaving = useRef(false)
  const go = (fn) => { if (!leaving.current) { leaving.current = true; fn() } }

  useEffect(() => {
    if (left <= 0) { go(onDone); return }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [left]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = order.items.reduce((n, i) => n + i.quantity, 0)
  const paidOnline = order.payment?.method !== 'cod' && ['paid', 'refunded'].includes(order.payment?.status)
  const at = toDate(order.cancel?.at || order.updated_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="cx-done" role="dialog" aria-modal="true" aria-labelledby="cx-title">
      <div className="cx-mark" aria-hidden="true"><span><X size={58} strokeWidth={2.8} /></span></div>
      <h1 id="cx-title">Order cancelled</h1>
      <p className="cx-sub">Order #{order.order_number} was cancelled at {at}. The store has been told.</p>

      <div className="cx-stats">
        <div><b>{items}</b><span>Item{items === 1 ? '' : 's'}</span></div>
        <div><b>{rs(order.bill?.total)}</b><span>Order value</span></div>
        <div><b>{paidOnline ? rs(order.bill?.total) : '₹0'}</b><span>{paidOnline ? 'Refunding' : 'Charged'}</span></div>
      </div>

      <section className="cx-card">
        {reason && <div><span>Reason</span><b>{reason}</b></div>}
        <div><span>Refund</span><b>{paidOnline ? `${rs(order.bill?.total)} in 3–5 days` : 'Nothing to refund (cash order)'}</b></div>
        <small>{paidOnline ? 'The money goes back to the same account you paid from.' : 'You weren’t charged anything for this order.'}</small>
      </section>

      <div className="cx-foot">
        <div className="cx-bar" aria-hidden="true"><span style={{ width: `${((SECONDS - left) / SECONDS) * 100}%` }} /></div>
        <span className="cx-count" aria-live="polite">{left > 0 ? `Taking you home in ${left}s` : 'Opening home…'}</span>
        <div className="cx-btns">
          <button type="button" className="ghost" onClick={() => go(onDone)}>Go home</button>
          <button type="button" onClick={() => go(onOrderAgain)}>Order again</button>
        </div>
      </div>
    </div>
  )
}
