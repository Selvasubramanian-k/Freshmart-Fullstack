import { useEffect, useState } from 'react'
import { Check, Star } from 'lucide-react'
import { api } from '../../shared/api/client.js'

// ─────────────────────────────────────────────────────────────
//  "Order delivered!" full screen (design A). Track page la status
//  delivered aanadhum idhu varum, countdown mudinjadhum home ku pogum.
//  Star kudutha countdown thirumba aarambikkum (rating podra time kudukka).
// ─────────────────────────────────────────────────────────────
const SECONDS = 6
const toDate = (iso) => (iso ? new Date(/Z$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`) : null)
const rs = (n) => `₹${Number(n || 0).toFixed(0)}`

export default function DeliveredScreen({ order, onDone }) {
  const [left, setLeft] = useState(SECONDS)
  const [stars, setStars] = useState(order.rating?.stars || 0)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (left <= 0) { onDone(); return }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [left, onDone])

  const rate = (n) => {
    setStars(n); setLeft(SECONDS); setSaved(false)
    api.post(`/api/customer/orders/${order.id}/rate`, { stars: n }).then(() => setSaved(true)).catch(() => {})
  }

  const placed = toDate(order.created_at)
  const done = toDate(order.delivered_at)
  const mins = placed && done ? Math.max(1, Math.round((done - placed) / 60000)) : null
  const time = done ? done.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : ''
  const rider = order.partner?.name?.split(' ')[0]
  const cod = order.payment?.method === 'cod'

  return (
    <div className="dv-page" role="dialog" aria-modal="true" aria-labelledby="dv-title">
      <div className="dv-confetti" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => <span key={i} className={`c${i % 5}`} style={{ left: `${(i * 7.3) % 100}%`, animationDelay: `${(i % 7) * 0.35}s` }} />)}
      </div>

      <div className="dv-tick"><Check size={64} strokeWidth={3} /></div>
      <h1 id="dv-title">{order.is_exchange ? 'Exchange done!' : 'Order delivered!'}</h1>
      <p className="dv-sub">
        {order.is_exchange
          ? `${rider ? `${rider} brought` : 'We delivered'} your fresh item${time ? ` at ${time}` : ''} and took the old one back.`
          : `${rider ? `${rider} handed over` : 'We delivered'} order #${order.order_number}${time ? ` at ${time}` : ''}. Enjoy your groceries.`}
      </p>

      <div className="dv-stats">
        {mins && <div><b>{mins} min</b><span>Delivery time</span></div>}
        <div><b>{order.items_count}</b><span>Items</span></div>
        {order.is_exchange
          ? <div><b>Free</b><span>Exchange</span></div>
          : <div><b>{rs(order.bill?.total)}</b><span>{cod ? 'Paid (cash)' : 'Paid online'}</span></div>}
      </div>

      <div className="dv-rate">
        <span>{rider ? `How was ${rider}'s delivery?` : 'How was your delivery?'}</span>
        <div className="dv-stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={n <= stars} onClick={() => rate(n)}>
              <Star size={26} fill={n <= stars ? '#f5a623' : 'none'} color={n <= stars ? '#f5a623' : '#9aa3ad'} />
            </button>
          ))}
        </div>
        {saved && <small>Thanks for rating!</small>}
      </div>

      <div className="dv-foot">
        <div className="dv-bar" aria-hidden="true"><span style={{ width: `${((SECONDS - left) / SECONDS) * 100}%` }} /></div>
        <span className="dv-count" aria-live="polite">{left > 0 ? `Taking you home in ${left}s` : 'Opening home…'}</span>
        <button type="button" className="dv-btn" onClick={onDone}>Continue shopping</button>
      </div>
    </div>
  )
}
