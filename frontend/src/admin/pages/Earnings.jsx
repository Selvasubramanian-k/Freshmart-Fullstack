import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, Undo2, ShoppingCart } from 'lucide-react'
import { api } from '../../shared/api/client.js'
import { ErrorNote, PageHead, StatCard } from '../components/ui.jsx'
import { rs } from '../utils/format.js'
import { rangeBounds, ymd } from '../utils/dateRange.js'

// ─────────────────────────────────────────────────────────────
//  Earnings = Online orders (delivered, commission cut) + In-store (counter) sales.
// ─────────────────────────────────────────────────────────────
const RANGES = [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['custom', 'Pick dates']]
const VIEWS = [['both', 'Both'], ['online', 'Online'], ['store', 'In-store']]
const PAY = { cash: 'Cash', upi: 'UPI', card: 'Card' }
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

function Row({ label, value, tone }) {
  return <div className="ad-er-row"><span>{label}</span><span className={tone || ''}>{value}</span></div>
}

function DailyChart({ daily, view }) {
  const showOn = view !== 'store', showSt = view !== 'online'
  const vals = daily.map(d => ({ ...d, on: showOn ? d.online : 0, st: showSt ? d.store : 0 }))
  const max = Math.max(1, ...vals.map(d => d.on + d.st))
  const many = daily.length > 14
  const label = (iso) => {
    const d = new Date(`${iso}T00:00`)
    return many ? String(d.getDate()) : d.toLocaleDateString('en-IN', daily.length > 7 ? { day: 'numeric', month: 'short' } : { weekday: 'short' })
  }
  return (
    <div className="ad-er-chart" role="img"
      aria-label={vals.map(d => `${d.date}: ${showOn ? `online ${rs(d.on)}` : ''}${showOn && showSt ? ', ' : ''}${showSt ? `in-store ${rs(d.st)}` : ''}`).join('; ')}>
      {vals.map(d => (
        <div key={d.date} className="ad-er-col" title={`${d.date} · Online ${rs(d.online)} · In-store ${rs(d.store)}`}>
          {!many && <span className="ad-er-val">{d.on + d.st ? rs(Math.round(d.on + d.st)) : ''}</span>}
          <div className="ad-er-stack">
            {d.st > 0 && <span className="st" style={{ height: `${(d.st / max) * 100}%` }} />}
            {d.on > 0 && <span className="on" style={{ height: `${(d.on / max) * 100}%` }} />}
          </div>
          <span className="ad-er-lbl">{label(d.date)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Earnings() {
  const [range, setRange] = useState('week')
  const [from, setFrom]   = useState('')
  const [to, setTo]       = useState('')
  const [view, setView]   = useState('both')
  const [e, setE]         = useState(null)
  const [error, setError] = useState('')

  const bounds = useMemo(() => rangeBounds(range, from, to), [range, from, to])

  useEffect(() => {
    if (!bounds.start) return
    const tz = -new Date().getTimezoneOffset()
    let live = true
    api.get(`/api/admin/earnings?date_from=${bounds.start.toISOString()}&date_to=${bounds.end.toISOString()}&tz=${tz}`)
      .then(r => { if (live) { setE(r); setError('') } })
      .catch(err => { if (live) setError(err.message) })
    return () => { live = false }
  }, [bounds])

  const pickRange = (id) => {
    if (id === 'custom' && !from) { const t = new Date(); setTo(ymd(t)); setFrom(ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 6))) }
    setRange(id)
  }

  const on = e?.online, st = e?.store
  const onShare = e ? pct(on.net, e.total) : 0

  return (
    <>
      <PageHead title="Earnings" sub={`Online orders and in-store sales together. ${e ? `Commission (${e.commission_percent}%) is only on online orders.` : ''}`}>
        <Link className="ad-btn" to="/admin/counter"><ShoppingCart size={16} /> Counter sale</Link>
      </PageHead>

      <div className="ad-range">
        <div className="ad-chips">
          {RANGES.map(([id, label]) => (
            <button key={id} type="button" className={`ad-chip ${range === id ? 'on' : ''}`} aria-pressed={range === id} onClick={() => pickRange(id)}>{label}</button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="ad-range-dates">
            <label>From <input className="ad-input" type="date" value={from} max={to || undefined} onChange={(ev) => setFrom(ev.target.value)} /></label>
            <label>To <input className="ad-input" type="date" value={to} min={from || undefined} onChange={(ev) => setTo(ev.target.value)} /></label>
          </div>
        )}
      </div>

      <ErrorNote>{error}</ErrorNote>
      {!e ? <p className="ad-muted">Loading earnings…</p> : (
        <>
          <section className="ad-card ad-er-hero">
            <div className="ad-er-hero-top">
              <div>
                <span className="ad-muted">Total earnings · {bounds.text}</span>
                <b className="ad-er-big">{rs(e.total)}</b>
              </div>
              <span className="ad-muted">{on.orders + st.bills} sales · after commission</span>
            </div>
            {e.total > 0 ? (
              <div className="ad-er-split" role="img" aria-label={`Online ${onShare} percent, in-store ${100 - onShare} percent`}>
                {on.net > 0 && <span className="on" style={{ flexGrow: on.net }} />}
                {st.total > 0 && <span className="st" style={{ flexGrow: st.total }} />}
              </div>
            ) : <div className="ad-er-split empty" />}
            <div className="ad-er-legend">
              <span><i className="on" /><b>Online {rs(on.net)}</b><span className="ad-muted">{onShare}%</span></span>
              <span><i className="st" /><b>In-store {rs(st.total)}</b><span className="ad-muted">{e.total > 0 ? 100 - onShare : 0}%</span></span>
            </div>
          </section>

          <div className="ad-er-cards">
            <section className="ad-card">
              <div className="ad-er-card-head"><i className="on" /><b>Online orders</b><span className="ad-muted ad-small">{on.orders} delivered</span></div>
              <Row label="Item sales" value={rs(on.gross)} />
              <Row label={`Commission (${e.commission_percent}%)`} value={`− ${rs(on.commission)}`} tone="ad-er-minus" />
              <div className="ad-er-row total"><b>You get</b><b>{rs(on.net)}</b></div>
            </section>
            <section className="ad-card">
              <div className="ad-er-card-head"><i className="st" /><b>In-store sales</b><span className="ad-muted ad-small">{st.bills} bills</span></div>
              <Row label="Counter bills" value={rs(st.total)} />
              <Row label="Commission" value="No commission" />
              <div className="ad-er-row total"><b>You get</b><b>{rs(st.total)}</b></div>
            </section>
            <section className="ad-card">
              <div className="ad-er-card-head"><b>How customers paid</b></div>
              <Row label="Cash at counter" value={rs(st.cash)} />
              <Row label="UPI at counter" value={rs(st.upi)} />
              <Row label="Card at counter" value={rs(st.card)} />
              <Row label="Paid online (app)" value={rs(on.prepaid)} />
              <Row label="Cash on delivery" value={rs(on.cod)} />
              <div className="ad-er-row total"><b>Cash from counter today</b><b>{rs(e.cash_today)}</b></div>
            </section>
          </div>

          <div className="ad-er-bottom">
            <section className="ad-card">
              <div className="ad-card-head">
                <h2>Earnings per day</h2>
                <div className="ad-tabs compact">
                  {VIEWS.map(([id, label]) => <button key={id} className={`ad-tab ${view === id ? 'on' : ''}`} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}
                </div>
              </div>
              <DailyChart daily={e.daily} view={view} />
              <div className="ad-er-legend small">
                {view !== 'store' && <span><i className="on" />Online (after commission)</span>}
                {view !== 'online' && <span><i className="st" />In-store</span>}
              </div>
            </section>
            <section className="ad-card">
              <div className="ad-card-head"><h2>Latest in-store bills</h2><Link className="ad-linkbtn" to="/admin/counter">New bill</Link></div>
              {e.recent_bills.length === 0 ? <p className="ad-muted">No counter bills yet. Use Counter sale when a customer buys at the shop.</p> : (
                <ul className="ad-er-bills">
                  {e.recent_bills.map(b => (
                    <li key={b.id}>
                      <div><b>Bill {b.bill_no}</b><span className="ad-muted ad-small">
                        {new Date(b.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {b.items.reduce((n, i) => n + i.quantity, 0)} items
                      </span></div>
                      <span className="ad-er-pay">{PAY[b.payment_method] || b.payment_method}</span>
                      <b>{rs(b.total)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="ad-stats ad-er-mini">
            <StatCard icon={Banknote} label="COD to collect" value={e.cod_pending_orders} hint="Open cash orders" tone="amber" />
            <StatCard icon={Undo2} label="Refunded orders" value={e.refunded_orders} tone="red" />
          </div>
        </>
      )}
    </>
  )
}
