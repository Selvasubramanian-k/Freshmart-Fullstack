import { useState } from 'react'
import RangeTabs from '../RangeTabs.jsx'
import { useReport } from '../useReport.js'
import { PageHead, ErrorNote } from '../../admin/components/ui.jsx'
import { rs } from '../../admin/utils/format.js'

function csv(r) {
  const head = ['Store', 'Area', 'Delivered orders', 'Item sales', 'Commission %', 'Commission', 'Pay the store']
  const rows = r.stores.map((s) => [s.store, s.area, s.delivered, s.item_sales, s.commission_pct, s.commission, s.payout])
  const text = [head, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  a.download = `freshmart-payouts-${r.days}d.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function Money() {
  const [days, setDays] = useState(7)
  const [r, error] = useReport(days)
  return (
    <>
      <PageHead title="Commission & payouts" sub="Commission is on delivered online orders (item price, not delivery fee or tips). Payout = what you send each store.">
        {r && r.stores.length > 0 && <button className="ad-btn ghost" onClick={() => csv(r)}>Download for Excel</button>}
      </PageHead>
      <ErrorNote>{error}</ErrorNote>
      <RangeTabs days={days} setDays={setDays} />
      {!r ? <p className="ad-muted">Loading…</p> : (
        <>
          <div className="ow-stats three">
            <div className="ad-card ow-num"><span>ITEM SALES (DELIVERED)</span><b>{rs(r.totals.item_sales)}</b></div>
            <div className="ad-card ow-num"><span>YOUR COMMISSION</span><b>{rs(r.totals.commission)}</b></div>
            <div className="ad-card ow-num"><span>PAY TO STORES</span><b>{rs(r.totals.payout)}</b></div>
          </div>
          <div className="ad-card flush"><div className="ad-table-wrap"><table className="ad-table">
            <thead><tr><th>Store</th><th>Delivered orders</th><th>Item sales</th><th>Commission</th><th>Pay the store</th></tr></thead>
            <tbody>
              {r.stores.length === 0 && <tr><td colSpan={5} className="ad-muted">No delivered orders in this time.</td></tr>}
              {r.stores.map((s) => (
                <tr key={s.store_id}>
                  <td><b>{s.store}</b><span className="ad-muted ad-block ad-small">{s.area}</span></td>
                  <td>{s.delivered}</td><td>{rs(s.item_sales)}</td>
                  <td>{rs(s.commission)} <span className="ad-muted ad-small">({s.commission_pct}%)</span></td>
                  <td><b>{rs(s.payout)}</b></td>
                </tr>
              ))}
            </tbody>
          </table></div></div>
          <p className="ad-muted ad-small">Change a store’s commission in Stores. In-store counter sales are not part of this (no commission).</p>
        </>
      )}
    </>
  )
}
