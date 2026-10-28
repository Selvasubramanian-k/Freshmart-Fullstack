import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Package, Minus, Plus, Check, Printer, MessageCircle, Trash2 } from 'lucide-react'
import { api } from '../../shared/api/client.js'
import { resolveImage } from '../../shared/utils/images.js'
import { ErrorNote, PageHead } from '../components/ui.jsx'
import { rs } from '../utils/format.js'
import { addDays, dayStart } from '../utils/dateRange.js'

// ─────────────────────────────────────────────────────────────
//  Counter sale: kadaikku nerla vandhu vaangura customer ku bill.
//  Save pannina stock thaane kammi aagum, Earnings la "In-store" ah varum.
// ─────────────────────────────────────────────────────────────
const PAYS = [['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card']]
const LOW = 5

function waLink(phone, sale, storeName) {
  const lines = sale.items.map(i => `${i.name} × ${i.quantity} = ₹${i.total}`)
  const text = [`${storeName || 'FreshMart'} · Bill ${sale.bill_no}`, ...lines, `Total: ₹${sale.total}`, 'Thank you!'].join('\n')
  return `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`
}

function Receipt({ sale, storeName }) {
  return (
    <div className="ad-receipt" aria-hidden="true">
      <b>{storeName || 'FreshMart'}</b>
      <span>Bill {sale.bill_no} · {new Date(sale.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
      <table>
        <tbody>
          {sale.items.map(i => (
            <tr key={i.pid}><td>{i.name} × {i.quantity}</td><td>{rs(i.total)}</td></tr>
          ))}
        </tbody>
      </table>
      <p><b>Total</b><b>{rs(sale.total)}</b></p>
      <span>Paid by {PAYS.find(p => p[0] === sale.payment_method)?.[1]}{sale.change != null ? ` · Change ${rs(sale.change)}` : ''}</span>
      <span>Thank you!</span>
    </div>
  )
}

export default function Counter() {
  const [products, setProducts] = useState(null)
  const [cats, setCats]         = useState([])
  const [storeName, setStoreName] = useState('')
  const [today, setToday]       = useState(null)
  const [error, setError]       = useState('')
  const [q, setQ]               = useState('')
  const [cat, setCat]           = useState('')
  const [bill, setBill]         = useState({})          // pid -> qty
  const [pay, setPay]           = useState('cash')
  const [given, setGiven]       = useState('')
  const [phone, setPhone]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [saved, setSaved]       = useState(null)

  const loadToday = useCallback(() => {
    const start = dayStart(new Date())
    api.get(`/api/admin/sales?limit=1&date_from=${start.toISOString()}&date_to=${addDays(start, 1).toISOString()}`)
      .then(setToday).catch(() => {})
  }, [])
  useEffect(() => {
    api.get('/api/admin/products').then(setProducts).catch(e => setError(e.message))
    api.get('/api/admin/categories').then(setCats).catch(() => {})
    api.get('/api/admin/store').then(s => setStoreName(s.name)).catch(() => {})
    loadToday()
  }, [loadToday])

  const byPid = useMemo(() => Object.fromEntries((products || []).map(p => [p.pid, p])), [products])
  const usedCats = useMemo(() => cats.filter(c => (products || []).some(p => p.category === c.id)), [cats, products])
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (products || []).filter(p => (!cat || p.category === cat) && (!s || p.name.toLowerCase().includes(s) || String(p.pid) === s))
  }, [products, q, cat])

  const lines = Object.entries(bill).map(([pid, qty]) => ({ p: byPid[pid], qty })).filter(l => l.p)
  const total = Math.round(lines.reduce((a, l) => a + l.p.price * l.qty, 0) * 100) / 100
  const units = lines.reduce((a, l) => a + l.qty, 0)
  const change = given === '' ? null : Number(given) - total

  const setQty = (pid, n) => setBill(b => {
    const next = { ...b }
    if (n <= 0) delete next[pid]; else next[pid] = Math.min(n, byPid[pid]?.stock ?? n)
    return next
  })
  const add = (p) => { if ((bill[p.pid] || 0) < p.stock) setQty(p.pid, (bill[p.pid] || 0) + 1) }

  const save = async () => {
    if (!lines.length) return
    if (pay === 'cash' && change !== null && change < 0) return setError(`Cash given is less than the bill (${rs(total)}).`)
    if (phone && !/^[6-9]\d{9}$/.test(phone)) return setError('Enter a 10-digit mobile number, or leave it empty.')
    setBusy(true); setError('')
    try {
      const sale = await api.post('/api/admin/sales', {
        items: lines.map(l => ({ pid: l.p.pid, quantity: l.qty })),
        payment_method: pay,
        cash_given: pay === 'cash' && given !== '' ? Number(given) : null,
        customer_phone: phone || null,
      })
      setProducts(ps => ps.map(p => bill[p.pid] ? { ...p, stock: p.stock - bill[p.pid] } : p))
      setSaved(sale); setBill({}); setGiven(''); setPhone(''); loadToday()
    } catch (e) {
      setError(e.message)
      api.get('/api/admin/products').then(setProducts).catch(() => {})   // stock may have changed
    } finally { setBusy(false) }
  }
  const newBill = () => { setSaved(null); setBill({}); setGiven(''); setPhone(''); setPay('cash'); setError('') }

  return (
    <>
      <PageHead title="Counter sale" sub="For customers who come to the shop. Stock goes down by itself when you save the bill.">
        {today && <span className="ad-pos-today">Today: <b>{today.count} bill{today.count === 1 ? '' : 's'} · {rs(today.total)}</b></span>}
      </PageHead>

      <div className="ad-pos">
        <section className="ad-pos-left" aria-label="Products">
          <div className="ad-search ad-pos-search"><Search size={16} />
            <input placeholder="Search product name or #id" aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
          <div className="ad-chips">
            <button type="button" className={`ad-chip ${!cat ? 'on' : ''}`} aria-pressed={!cat} onClick={() => setCat('')}>All</button>
            {usedCats.map(c => (
              <button key={c.id} type="button" className={`ad-chip ${cat === c.id ? 'on' : ''}`} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</button>
            ))}
          </div>
          {!products ? <p className="ad-muted">Loading products…</p> : list.length === 0 ? <p className="ad-muted">No products match.</p> : (
            <div className="ad-pos-grid">
              {list.map(p => {
                const inBill = bill[p.pid] || 0
                const left = p.stock - inBill
                const out = p.stock === 0
                const img = resolveImage(p.image_url)
                return (
                  <button key={p.pid} type="button" className={`ad-pos-card ${inBill ? 'in' : ''}`} disabled={out || left <= 0}
                    aria-label={out ? `${p.name}, out of stock` : `Add ${p.name}, ${rs(p.price)}`} onClick={() => add(p)}>
                    {inBill > 0 && <span className="ad-pos-qty">{inBill}</span>}
                    <span className="ad-pos-img">{img ? <img src={img} alt="" loading="lazy" /> : <Package size={22} />}</span>
                    <b className="ad-pos-name">{p.name}</b>
                    <span className="ad-pos-row"><b>{rs(p.price)}</b><span className="ad-muted">{p.unit}</span></span>
                    <span className={`ad-pos-stock ${out ? 'out' : left <= LOW ? 'low' : ''}`}>
                      {out ? 'Out of stock' : left <= 0 ? 'All in bill' : left <= LOW ? `Only ${left} left` : `${left} in stock`}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="ad-pos-bill" aria-label="Bill">
          <div className="ad-pos-bill-head"><b>{saved ? `Bill ${saved.bill_no}` : 'New bill'}</b><span className="ad-muted">{saved ? '' : `${units} item${units === 1 ? '' : 's'}`}</span></div>

          {saved ? (
            <div className="ad-pos-done">
              <span className="ad-pos-done-ic"><Check size={28} strokeWidth={2.6} /></span>
              <b>Bill saved · {rs(saved.total)}</b>
              <span className="ad-muted">Added to today’s in-store earnings. Stock updated for {saved.items.length} product{saved.items.length > 1 ? 's' : ''}.</span>
              {saved.change != null && saved.change > 0 && <span className="ad-pos-change">Give back {rs(saved.change)}</span>}
              <div className="ad-pos-done-actions">
                <button type="button" className="ad-btn ghost" onClick={() => window.print()}><Printer size={16} /> Print bill</button>
                {saved.customer_phone && (
                  <a className="ad-btn ghost" href={waLink(saved.customer_phone, saved, storeName)} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Send on WhatsApp</a>
                )}
              </div>
              <button type="button" className="ad-btn" onClick={newBill}>New bill</button>
              <Receipt sale={saved} storeName={storeName} />
            </div>
          ) : (
            <>
              <div className="ad-pos-lines">
                {lines.length === 0 && <p className="ad-muted ad-pos-empty">Tap a product to add it to the bill.</p>}
                {lines.map(({ p, qty }) => (
                  <div key={p.pid} className="ad-pos-line">
                    <div className="ad-pos-line-name"><b>{p.name}</b><span className="ad-muted ad-small">{rs(p.price)} × {qty} · {p.unit}</span></div>
                    <div className="ad-pos-step">
                      <button type="button" aria-label={qty === 1 ? `Remove ${p.name}` : `One less ${p.name}`} onClick={() => setQty(p.pid, qty - 1)}>{qty === 1 ? <Trash2 size={15} /> : <Minus size={16} />}</button>
                      <b>{qty}</b>
                      <button type="button" aria-label={`One more ${p.name}`} disabled={qty >= p.stock} onClick={() => setQty(p.pid, qty + 1)}><Plus size={16} /></button>
                    </div>
                    <b className="ad-pos-line-total">{rs(p.price * qty)}</b>
                  </div>
                ))}
              </div>

              <div className="ad-pos-foot">
                <div className="ad-pos-total"><span>Total</span><b>{rs(total)}</b></div>
                <div className="ad-pos-pay" role="group" aria-label="Payment">
                  {PAYS.map(([id, label]) => (
                    <button key={id} type="button" className={pay === id ? 'on' : ''} aria-pressed={pay === id} onClick={() => setPay(id)}>{label}</button>
                  ))}
                </div>
                {pay === 'cash' && (
                  <div className="ad-pos-cash">
                    <label htmlFor="pos-given">Cash given ₹</label>
                    <input id="pos-given" className="ad-input" inputMode="numeric" value={given} onChange={(e) => setGiven(e.target.value.replace(/[^\d.]/g, ''))} />
                    {change !== null && <span className={change >= 0 ? 'ok' : 'bad'}>{change >= 0 ? `Give back ${rs(change)}` : `Short by ${rs(-change)}`}</span>}
                  </div>
                )}
                {pay === 'upi' && <span className="ad-pos-note">Show your shop’s UPI QR. Save the bill after the money comes.</span>}
                <label className="ad-field">Customer phone (optional, for a WhatsApp bill)
                  <input className="ad-input" inputMode="tel" maxLength={10} placeholder="10-digit mobile" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
                </label>
                <ErrorNote>{error}</ErrorNote>
                <button type="button" className="ad-btn ad-pos-save" disabled={!lines.length || busy} onClick={save}>
                  {busy ? 'Saving…' : lines.length ? `Save bill · ${rs(total)}` : 'Add items to save'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  )
}
