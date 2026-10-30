import { useState } from 'react'
import { PageHead, ErrorNote } from '../../admin/components/ui.jsx'
import { rs } from '../../admin/utils/format.js'
import RangeTabs from '../RangeTabs.jsx'
import { useReport } from '../useReport.js'

export default function Reports() {
  const [days, setDays] = useState(7)
  const [r, error] = useReport(days)
  const maxArea = Math.max(1, ...(r?.by_area || []).map((a) => a.sales))
  return (
    <>
      <PageHead title="Reports" sub="How each store, area and product is doing." />
      <ErrorNote>{error}</ErrorNote>
      <RangeTabs days={days} setDays={setDays} />
      {!r ? <p className="ad-muted">Loading…</p> : (
        <>
          <div className="ad-card flush"><div className="ad-table-wrap"><table className="ad-table">
            <thead><tr><th>Store</th><th>Orders</th><th>Delivered</th><th>Cancelled</th><th>Refunds</th><th>Average order</th><th>Sales</th></tr></thead>
            <tbody>
              {r.stores.length === 0 && <tr><td colSpan={7} className="ad-muted">No orders in this time.</td></tr>}
              {r.stores.map((s) => {
                const cancelPct = s.orders ? Math.round((s.cancelled / s.orders) * 100) : 0
                return (
                  <tr key={s.store_id}>
                    <td><b>{s.store}</b><span className="ad-muted ad-block ad-small">{s.area}</span></td>
                    <td>{s.orders}</td><td>{s.delivered}</td>
                    <td>{s.cancelled}{cancelPct >= 10 && <span className="ad-badge red" style={{ marginLeft: 6 }}>{cancelPct}%</span>}</td>
                    <td>{s.refunded}</td><td>{rs(s.avg_order)}</td><td><b>{rs(s.total)}</b></td>
                  </tr>
                )
              })}
            </tbody>
          </table></div></div>
          <div className="ow-grid">
            <section className="ad-card">
              <div className="ad-card-head"><h2>Best sellers</h2><span className="ad-muted ad-small">delivered, all stores</span></div>
              {r.top_products.length === 0 ? <p className="ad-muted">Nothing delivered yet.</p> : (
                <table className="ad-table"><tbody>
                  {r.top_products.map((p, i) => <tr key={p.name}><td className="ad-muted">{i + 1}</td><td><b>{p.name}</b></td><td>{p.qty} sold</td><td>{rs(p.sales)}</td></tr>)}
                </tbody></table>
              )}
            </section>
            <section className="ad-card">
              <div className="ad-card-head"><h2>Sales by area</h2></div>
              {r.by_area.length === 0 ? <p className="ad-muted">No sales yet.</p> : (
                <div className="ow-hbars">
                  {r.by_area.map((a) => (
                    <div key={a.area}><span>{a.area}</span><i><b style={{ width: `${(a.sales / maxArea) * 100}%` }} /></i><em>{rs(a.sales)}</em></div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </>
  )
}
