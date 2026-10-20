import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, IndianRupee, PackageX, MessageSquareWarning, Package, Users } from 'lucide-react'
import { api } from '../../shared/api/client.js'
import { PageHead, StatCard, StatusBadge, ErrorNote, Empty } from '../components/ui.jsx'
import { fmtDateTime, rs } from '../utils/format.js'
import BarChart from '../components/BarChart.jsx'

export default function Dashboard() {
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = () => api.get('/api/admin/dashboard').then(setD).catch(e => setError(e.message))
    load()
    const t = setInterval(load, 15000)
    window.addEventListener('focus', load)
    return () => { clearInterval(t); window.removeEventListener('focus', load) }
  }, [])

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!d) return <p className="ad-muted">Loading dashboard…</p>

  const s = d.orders_by_status
  return (
    <>
      <PageHead title="Dashboard" sub={`Here's how ${d.store.name} is doing today.`} />

      <div className="ad-stats">
        <StatCard icon={ClipboardList} label="Orders to handle" value={d.pending_orders}
          hint={`${s.placed || 0} new · ${s.confirmed || 0} confirmed · ${s.packed || 0} packed`} tone="amber"
          onClick={() => navigate('/admin/orders')} />
        <StatCard icon={IndianRupee} label="Net earnings" value={rs(d.net_earnings)} hint="Delivered orders, after commission"
          onClick={() => navigate('/admin/earnings')} />
        <StatCard icon={PackageX} label="Low stock" value={d.low_stock_count} hint="10 units or fewer" tone="red"
          onClick={() => navigate('/admin/products?low=1')} />
        <StatCard icon={MessageSquareWarning} label="Open complaints" value={d.open_complaints} tone="blue"
          onClick={() => navigate('/admin/complaints')} />
        <StatCard icon={Package} label="Products" value={d.products_total} hint={`${d.orders_today} orders today`} tone="violet"
          onClick={() => navigate('/admin/products')} />
        <StatCard icon={Users} label="Active staff" value={d.staff_count} tone="grey" onClick={() => navigate('/admin/staff')} />
      </div>

      <div className="ad-grid-2">
        <section className="ad-card">
          <div className="ad-card-head"><h2>Earnings, last 7 days</h2></div>
          <BarChart data={d.daily.map(x => ({ label: x.date.slice(5), value: x.net }))} format={rs} />
        </section>

        <section className="ad-card">
          <div className="ad-card-head">
            <h2>Running low</h2>
            <button className="ad-link" onClick={() => navigate('/admin/products?low=1')}>Restock</button>
          </div>
          {d.low_stock.length === 0 ? <Empty title="All stocked up" /> : (
            <ul className="ad-list">
              {d.low_stock.map(p => (
                <li key={p.pid}>
                  <span>{p.name} <span className="ad-muted">{p.unit}</span></span>
                  <span className={`ad-stock ${p.stock === 0 ? 'out' : 'low'}`}>{p.stock === 0 ? 'Out of stock' : `${p.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="ad-card">
        <div className="ad-card-head">
          <h2>Recent orders</h2>
          <button className="ad-link" onClick={() => navigate('/admin/orders')}>View all</button>
        </div>
        {d.recent_orders.length === 0 ? <Empty icon={ClipboardList} title="No orders yet" text="New orders from customers will show up here." /> : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Placed</th></tr></thead>
              <tbody>
                {d.recent_orders.map(o => (
                  <tr key={o.id} className="clickable" onClick={() => navigate(`/admin/orders?open=${o.id}`)}>
                    <td className="mono">#{o.order_number}</td>
                    <td>{o.customer_name}</td>
                    <td>{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                    <td>{rs(o.bill.total)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="ad-muted">{fmtDateTime(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
