// Order details timeline (design A): 5 steps in a row with icon, time and the gap
// from the step before. Slow gaps turn orange. Summary chips underneath.
import { useEffect, useState } from 'react'
import { Bike, Check, CircleX, Home, Package, ShoppingBag } from 'lucide-react'
import { asDate } from '../utils/format.js'

// minutes a step normally takes (more = orange)
const USUAL = { confirmed: 5, packed: 10, out_for_delivery: 15, delivered: 20 }
const WAITING = { confirmed: 'store to accept', packed: 'packing', out_for_delivery: 'pickup', delivered: 'delivery' }
const STEPS = [
  { key: 'placed', label: 'Placed', icon: ShoppingBag },
  { key: 'confirmed', label: 'Accepted', icon: Check },
  { key: 'packed', label: 'Packed', icon: Package },
  { key: 'out_for_delivery', label: 'Picked up', icon: Bike, rider: true },
  { key: 'delivered', label: 'Delivered', icon: Home, rider: true },
]

const time = (d) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
const mins = (a, b) => Math.max(0, Math.round((b - a) / 60000))
const fmtMins = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`)

export default function OrderJourney({ order }) {
  const live = ['placed', 'confirmed', 'packed', 'out_for_delivery'].includes(order.status)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!live) return
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [live])

  // first time each step happened
  const at = {}
  for (const h of order.status_history || []) if (!at[h.status]) at[h.status] = asDate(h.at)
  const cancelled = at.cancelled
  const p = order.partner
  const rider = p?.name?.split(' ')[0]

  const steps = STEPS.map((s) => ({ ...s, at: at[s.key] }))
  let prev = null
  steps.forEach((s) => {
    if (s.at && prev) { s.took = mins(prev, s.at); s.slow = s.took > (USUAL[s.key] ?? 999) }
    if (s.at) prev = s.at
  })
  const doneCount = steps.filter((s) => s.at).length
  const current = live ? steps.find((s) => !s.at) : null   // the step we're waiting for
  // cancelled: replace the first step that never happened with a red "Cancelled"
  if (cancelled) {
    const i = steps.findIndex((s) => !s.at)
    if (i >= 0) steps[i] = { key: 'cancelled', label: 'Cancelled', icon: CircleX, at: cancelled, bad: true, took: prev ? mins(prev, cancelled) : null }
  }

  const start = at.placed
  let head = null
  if (at.delivered && start) head = { text: `Delivered in ${fmtMins(mins(start, at.delivered))}`, tone: 'good' }
  else if (cancelled) head = { text: 'Cancelled', tone: 'bad' }
  else if (live && start) head = { text: `Running ${fmtMins(mins(start, now))}${current ? ` · waiting for ${WAITING[current.key]}` : ''}`, tone: 'live' }

  const lastDone = Math.max(0, steps.reduce((n, s, i) => (s.at ? i : n), 0))
  const storeMins = !cancelled && at.confirmed && start ? mins(start, at.packed || at.confirmed) : null
  const riderMins = at.packed && at.delivered ? mins(at.packed, at.delivered) : null

  return (
    <div className="ad-tl">
      <div className="ad-tl-head">
        <p className="ad-od-h">Timeline</p>
        {head && <span className={`ad-tl-chip ${head.tone}`}>{head.text}</span>}
      </div>

      <ol className="ad-tl-steps" style={{ '--done': `${(lastDone / (STEPS.length - 1)) * 80}%` }}>
        {steps.map((s, i) => {
          const Icon = s.icon
          const isNow = current && s.key === current.key
          return (
            <li key={s.key} className={`ad-tl-step ${s.at ? 'done' : ''} ${isNow ? 'now' : ''} ${s.bad ? 'bad' : ''}`}>
              <span className="ad-tl-dot"><Icon size={18} strokeWidth={2.3} /></span>
              <b>{s.label}</b>
              <span className="ad-tl-time">{s.at ? time(s.at) : isNow ? `${fmtMins(mins(prev || start, now))}…` : '—'}</span>
              {s.took != null && i > 0 && (
                <span className={`ad-tl-gap ${s.slow ? 'slow' : ''}`}>+{fmtMins(s.took)}{s.rider && rider && !s.bad ? ` · ${rider}` : ''}</span>
              )}
            </li>
          )
        })}
      </ol>

      {(storeMins != null || riderMins != null || order.rating || cancelled) && (
        <div className="ad-tl-sum">
          {storeMins != null && <span>Store took <b>{fmtMins(storeMins)}</b> to accept{at.packed ? ' + pack' : ''}</span>}
          {riderMins != null && <span>{p?.in_house ? 'Our staff' : 'Rider'} took <b>{fmtMins(riderMins)}</b> to pick up + deliver</span>}
          {order.rating && <span>Customer rated <b>★ {order.rating.stars}</b></span>}
          {cancelled && (order.cancel
            ? <span>Customer cancelled{order.cancel.reason ? <>: <b>{order.cancel.reason}</b></> : ''}{order.cancel.message ? ` · “${order.cancel.message}”` : ''}</span>
            : <span>{order.status_history?.find((h) => h.status === 'cancelled')?.note || 'Cancelled'}</span>)}
        </div>
      )}
      {doneCount === 0 && <p className="ad-muted ad-small">No updates yet.</p>}
    </div>
  )
}
