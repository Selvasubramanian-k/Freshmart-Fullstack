import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IndianRupee, ShoppingBag, Percent, Store, Bike, UserPlus, Headset } from 'lucide-react'
import { api } from '../../shared/api/client.js'
import { PageHead, StatCard, ErrorNote } from '../../admin/components/ui.jsx'
import BarChart from '../../admin/components/BarChart.jsx'
import { rs } from '../../admin/utils/format.js'

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
const day = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })

export default function Overview() {
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const load = useCallback(() => api.get(`/api/owner/overview?tz=${-new Date().getTimezoneOffset()}`).then(setD).catch((e) => setError(e.message)), [])
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t) }, [load])

  const run = async (key, fn) => {
    setBusy(key); setError('')
    try { await fn(); await load() } catch (e) { setError(e.message) } finally { setBusy('') }
  }
  const approveStore = (n, yes) => run(n.id, () => api.patch(`/api/owner/stores/${n.id}`, { approve: yes }))

  if (!d) return <><PageHead title={`${greeting()}`} sub="Loading the marketplace…" /><ErrorNote>{error}</ErrorNote></>
  const change = d.sales_change_pct
  return (
    <>
      <PageHead title={greeting()} sub="The whole marketplace today: every store, every area.">
        <button className="ad-btn" onClick={() => navigate('/owner/stores?add=1')}>+ Add store</button>
      </PageHead>
      <ErrorNote>{error}</ErrorNote>
      <div className="ow-stats">
        <StatCard icon={IndianRupee} label="Today’s sales (all stores)" value={rs(d.sales_today)}
          hint={change === null ? 'No sales yesterday to compare' : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}% vs yesterday`} />
        <StatCard icon={ShoppingBag} tone="blue" label="Orders today" value={d.orders_today} hint={`${d.live_orders} live right now`} />
        <StatCard icon={Percent} tone="violet" label="Your commission today" value={rs(d.commission_today)} hint="On delivered orders" onClick={() => navigate('/owner/money')} />
        <StatCard icon={Store} tone="amber" label="Active stores" value={d.active_stores} hint={d.pending_stores ? `${d.pending_stores} waiting approval` : 'All approved'} onClick={() => navigate('/owner/stores')} />
      </div>

      <div className="ow-grid">
        <section className="ad-card">
          <div className="ad-card-head"><h2>Sales this week</h2><span className="ad-muted ad-small">all stores</span></div>
          <BarChart data={d.week.map((w) => ({ label: day(w.date), value: w.sales }))} format={rs} />
          <div className="ad-card-head" style={{ marginTop: 18 }}><h2>Top stores today</h2></div>
          {d.top_stores.length === 0 ? <p className="ad-muted">No orders yet today.</p> : (
            <div className="ad-table-wrap"><table className="ad-table">
              <thead><tr><th>Store</th><th>Area</th><th>Orders</th><th>Sales</th></tr></thead>
              <tbody>{d.top_stores.map((s) => <tr key={s.id}><td><b>{s.name}</b></td><td>{s.area}</td><td>{s.orders}</td><td>{rs(s.sales)}</td></tr>)}</tbody>
            </table></div>
          )}
        </section>

        <section className="ad-card">
          <div className="ad-card-head"><h2>Needs you</h2><span className="ad-muted ad-small">{d.needs.length ? `${d.needs.length} waiting` : 'All clear'}</span></div>
          {d.needs.length === 0 && <p className="ad-muted ad-small" style={{ margin: 0 }}>Nothing waiting. New store requests show up here. You can also watch big refunds and escalated tickets (the store admin and support team handle those).</p>}
          <div className="ow-needs">
            {d.needs.map((n) => (
              <div key={n.id} className={`ow-need ${n.kind === 'ticket' && !n.approval ? 'red' : ''}`}>
                <div><b>{n.title}</b><span>{n.text}</span></div>
                {n.kind === 'store' && <>
                  <button className="ad-btn sm" disabled={busy === n.id} onClick={() => approveStore(n, true)}>Approve</button>
                  <button className="ad-btn ghost sm" disabled={busy === n.id} onClick={() => approveStore(n, false)}>Reject</button>
                </>}
                {n.kind === 'ticket' && <button className="ad-btn ghost sm" onClick={() => navigate(`/support?ticket=${n.id}`)}>Open</button>}
              </div>
            ))}
          </div>
          <div className="ad-card-head" style={{ marginTop: 18 }}><h2>Live now</h2></div>
          <ul className="ow-live">
            <li><Bike size={16} /> Riders online <b>{d.riders_online}</b></li>
            <li><UserPlus size={16} /> New customers today <b>{d.new_customers_today}</b></li>
            <li><Headset size={16} /> Open support tickets <b>{d.open_tickets}</b></li>
          </ul>
        </section>
      </div>
    </>
  )
}
