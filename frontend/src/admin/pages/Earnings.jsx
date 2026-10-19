import { useEffect, useState } from 'react'
import { IndianRupee, Percent, ShoppingBag, Wallet, Undo2, Banknote } from 'lucide-react'
import { api } from '../../shared/api/client.js'
import { ErrorNote, PageHead, StatCard } from '../components/ui.jsx'
import BarChart from '../components/BarChart.jsx'
import { rs } from '../utils/format.js'

const RANGES = [7, 14, 30]

export default function Earnings() {
  const [days, setDays]   = useState(7)
  const [e, setE]         = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { api.get(`/api/admin/earnings?days=${days}`).then(setE).catch(err => setError(err.message)) }, [days])

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!e) return <p className="ad-muted">Loading earnings…</p>

  return (
    <>
      <PageHead title="Earnings" sub={`Based on delivered orders. Platform commission is ${e.commission_percent}% of item sales; delivery fees, tips and platform offers are not deducted from you.`} />

      <div className="ad-stats">
        <StatCard icon={Wallet} label="Net earnings" value={rs(e.net_earnings)} hint="Paid out to you" />
        <StatCard icon={IndianRupee} label="Gross item sales" value={rs(e.gross_sales)} tone="blue" />
        <StatCard icon={Percent} label="Platform commission" value={rs(e.platform_commission)} tone="grey" />
        <StatCard icon={ShoppingBag} label="Delivered orders" value={e.delivered_orders} hint={`Avg. ${rs(e.average_order_value)}`} tone="violet" />
        <StatCard icon={Banknote} label="COD to collect" value={e.cod_pending_orders} hint="Open cash orders" tone="amber" />
        <StatCard icon={Undo2} label="Refunded orders" value={e.refunded_orders} tone="red" />
      </div>

      <section className="ad-card">
        <div className="ad-card-head">
          <h2>Net earnings per day</h2>
          <div className="ad-tabs compact">
            {RANGES.map(r => <button key={r} className={`ad-tab ${days === r ? 'on' : ''}`} onClick={() => setDays(r)}>{r} days</button>)}
          </div>
        </div>
        <BarChart data={e.daily.map(x => ({ label: x.date.slice(5), value: x.net }))} format={rs} />
      </section>
    </>
  )
}
