import { useEffect, useState } from 'react'
import { api } from '../../shared/api/client.js'

const rs = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const time = (iso) => new Date(/Z$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

export default function Earnings() {
  const [days, setDays] = useState(1)
  const [e, setE] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { api.get(`/api/delivery/earnings?days=${days}`).then(setE).catch((x) => setError(x.message)) }, [days])

  return (
    <div className="rd-page">
      <header className="rd-earn-head">
        <div className="rd-earn-row">
          <h1>Earnings</h1>
          <div className="rd-seg" role="tablist">
            <button role="tab" aria-selected={days === 1} className={days === 1 ? 'on' : ''} onClick={() => setDays(1)}>Today</button>
            <button role="tab" aria-selected={days === 7} className={days === 7 ? 'on' : ''} onClick={() => setDays(7)}>7 days</button>
          </div>
        </div>
        <span>{days === 1 ? "Today's earnings" : 'Last 7 days'}</span>
        <b>{e ? rs(e.total) : '…'}</b>
      </header>

      {error && <p className="rd-error">{error}</p>}
      {e && (
        <div className="rd-earn-body">
          <div className="rd-stats">
            <div><b>{e.deliveries}</b><span>Deliveries</span></div>
            <div><b>{rs(e.base_fee)}</b><span>Per delivery</span></div>
            <div><b>{rs(e.tips)}</b><span>Tips</span></div>
          </div>

          <section className="rd-card">
            <div className="rd-line"><span>Delivery fees</span><b>{rs(e.fees)}</b></div>
            <div className="rd-line"><span>Customer tips</span><b>{rs(e.tips)}</b></div>
            <div className="rd-line total"><span>Your earnings</span><b>{rs(e.total)}</b></div>
            {e.cash_to_deposit > 0 && <div className="rd-line amber"><span>Cash collected (deposit at store)</span><b>{rs(e.cash_to_deposit)}</b></div>}
          </section>

          <section className="rd-card">
            <h2>Trips</h2>
            {e.trips.length === 0 ? <p className="rd-muted">No deliveries yet. Go online to start earning.</p> : e.trips.map((t) => (
              <div className="rd-trip" key={t.id}>
                <span className="rd-trip-time">{time(t.delivered_at)}</span>
                <div><b>{t.drop}</b><small>{t.store} · {t.cod ? 'Cash' : 'Prepaid'}</small></div>
                <b>{rs(t.earning)}</b>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  )
}
