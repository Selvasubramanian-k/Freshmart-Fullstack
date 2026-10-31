import { useEffect, useState } from 'react'
import { api } from '../../shared/api/client.js'
import { PageHead, Modal, ErrorNote } from '../../admin/components/ui.jsx'

const rs0 = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const offerText = (c) => (c.kind === 'pct' ? `${c.value}% off${c.max_off ? ` (up to ${rs0(c.max_off)})` : ''}` : `${rs0(c.value)} off`)
  + (c.min_order ? ` · orders above ${rs0(c.min_order)}` : '')

function NewOffer({ onSaved, onClose }) {
  const [f, setF] = useState({ code: '', title: '', kind: 'flat', value: '', max_off: '', min_order: '', ends_at: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: k === 'code' ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15) : e.target.value }))
  const submit = async (e) => {
    e.preventDefault()
    if (f.code.length < 3) return setError('Code needs 3 to 15 letters or numbers.')
    if (f.title.trim().length < 3) return setError('Write what the offer is, eg. “₹50 off your first order”.')
    if (!(Number(f.value) > 0)) return setError('Enter the discount.')
    setBusy(true); setError('')
    try {
      onSaved(await api.post('/api/owner/coupons', {
        code: f.code, title: f.title.trim(), kind: f.kind, value: Number(f.value),
        max_off: f.kind === 'pct' && f.max_off ? Number(f.max_off) : null, min_order: Number(f.min_order || 0),
        ends_at: f.ends_at ? new Date(`${f.ends_at}T23:59:59`).toISOString() : null,
      }))
    } catch (err) { setError(err.message); setBusy(false) }
  }
  return (
    <Modal title="New offer (coupon)" onClose={onClose}>
      <form className="ad-form" onSubmit={submit} noValidate>
        <label className="ad-field">Code<input className="ad-input" value={f.code} onChange={set('code')} placeholder="DIWALI" autoFocus /></label>
        <label className="ad-field">Discount type
          <select className="ad-input" value={f.kind} onChange={set('kind')}><option value="flat">₹ off</option><option value="pct">% off</option></select>
        </label>
        <label className="ad-field full">What customers see<input className="ad-input" value={f.title} onChange={set('title')} placeholder="10% off Pooja & Festive items" /></label>
        <label className="ad-field">{f.kind === 'pct' ? 'Percent off' : 'Rupees off'}<input className="ad-input" inputMode="decimal" value={f.value} onChange={set('value')} /></label>
        {f.kind === 'pct'
          ? <label className="ad-field">Max discount ₹ (optional)<input className="ad-input" inputMode="decimal" value={f.max_off} onChange={set('max_off')} /></label>
          : <span />}
        <label className="ad-field">Minimum order ₹<input className="ad-input" inputMode="decimal" value={f.min_order} onChange={set('min_order')} placeholder="0" /></label>
        <label className="ad-field">Last day (optional)<input className="ad-input" type="date" value={f.ends_at} onChange={set('ends_at')} /></label>
        <p className="ad-od-note full" style={{ background: '#e6f4ee', color: '#005c3c' }}>Works on every store. Customers type the code at checkout.</p>
        {error && <p className="ad-error full" role="alert">{error}</p>}
        <div className="ad-form-actions full">
          <button type="button" className="ad-btn ghost" onClick={onClose}>Cancel</button>
          <button className="ad-btn" disabled={busy}>{busy ? 'Saving…' : 'Start offer'}</button>
        </div>
      </form>
    </Modal>
  )
}

const FIELDS = [
  ['delivery_fee', 'Customer pays for delivery (₹)'],
  ['free_delivery_above', 'Free delivery for orders above (₹)'],
  ['rider_base_fee', 'Rider gets per delivery (₹)'],
  ['rider_per_km', 'Rider gets per km (₹)'],
]

function DeliveryCharges() {
  const [f, setF] = useState(null)
  const [saved, setSaved] = useState(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    api.get('/api/owner/delivery-settings').then((d) => { const v = Object.fromEntries(Object.entries(d).map(([k, x]) => [k, String(x)])); setF(v); setSaved(v) })
      .catch((e) => setError(e.message))
  }, [])
  if (!f) return <section className="ad-card"><p className="ad-muted">{error || 'Loading…'}</p></section>
  const n = (k) => Number(f[k] || 0)
  const ex = (km, tip) => n('rider_base_fee') + Math.min(km, n('rider_max_km_pay')) * n('rider_per_km') + tip
  const custFee = (order) => (order >= n('free_delivery_above') ? 0 : n('delivery_fee'))
  const changed = JSON.stringify(f) !== JSON.stringify(saved)
  const save = async () => {
    setError(''); setMsg('')
    try {
      const d = await api.put('/api/owner/delivery-settings', Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Number(v || 0)])))
      const v = Object.fromEntries(Object.entries(d).map(([k, x]) => [k, String(x)])); setF(v); setSaved(v); setMsg('Saved. New orders use these charges.')
    } catch (e) { setError(e.message) }
  }
  return (
    <section className="ad-card">
      <div className="ad-card-head"><h2>Delivery charges</h2><span className="ad-muted ad-small">for every store</span></div>
      <div className="ad-form">
        {FIELDS.map(([k, label]) => (
          <label key={k} className="ad-field">{label}
            <input className="ad-input" inputMode="decimal" value={f[k]} onChange={(e) => { setMsg(''); setF((s) => ({ ...s, [k]: e.target.value.replace(/[^\d.]/g, '').slice(0, 7) })) }} />
          </label>
        ))}
        <label className="ad-field">Pay km up to (max)<input className="ad-input" inputMode="decimal" value={f.rider_max_km_pay} onChange={(e) => setF((s) => ({ ...s, rider_max_km_pay: e.target.value.replace(/[^\d.]/g, '') }))} /></label>
        <label className="ad-field">Km when location is not known<input className="ad-input" inputMode="decimal" value={f.rider_km_when_unknown} onChange={(e) => setF((s) => ({ ...s, rider_km_when_unknown: e.target.value.replace(/[^\d.]/g, '') }))} /></label>
      </div>
      <div className="ow-examples">
        <b>Examples</b>
        <span>₹300 order, 2 km, ₹10 tip → customer pays ₹{custFee(300)} delivery · rider gets ₹{Math.round(ex(2, 10))}</span>
        <span>₹600 order, 4 km, no tip → customer pays ₹{custFee(600)} delivery · rider gets ₹{Math.round(ex(4, 0))}</span>
        <span className="ad-muted">The gap between what the customer pays and what the rider gets comes from your commission.</span>
      </div>
      {error && <p className="ad-error" role="alert">{error}</p>}
      {msg && <p className="ad-od-note" style={{ background: '#e6f4ee', color: '#005c3c' }}>{msg}</p>}
      <div className="ad-form-actions"><button className="ad-btn" disabled={!changed} onClick={save}>Save charges</button></div>
    </section>
  )
}

export default function AreasOffers() {
  const [areas, setAreas] = useState(null)
  const [coupons, setCoupons] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    api.get('/api/owner/areas').then((r) => setAreas(r.areas)).catch((e) => setError(e.message))
    api.get('/api/owner/coupons').then(setCoupons).catch((e) => setError(e.message))
  }, [])

  const toggleArea = async (a) => {
    const off = areas.filter((x) => (x.name === a.name ? x.on : !x.on)).map((x) => x.name)
    setError('')
    try { setAreas((await api.put('/api/owner/areas', { areas_off: off })).areas) } catch (e) { setError(e.message) }
  }
  const toggleCoupon = async (c) => {
    try { const n = await api.patch(`/api/owner/coupons/${c.id}`, { active: !c.active }); setCoupons((xs) => xs.map((x) => (x.id === n.id ? n : x))) } catch (e) { setError(e.message) }
  }

  return (
    <>
      <PageHead title="Areas, offers & delivery" sub="Where FreshMart delivers, offers for every store, and what customers pay and riders earn for delivery.">
        <button className="ad-btn" onClick={() => setAdding(true)}>+ New offer</button>
      </PageHead>
      <ErrorNote>{error}</ErrorNote>
      <div className="ow-grid">
        <section className="ad-card">
          <div className="ad-card-head"><h2>Delivery areas</h2><span className="ad-muted ad-small">tap to turn on / off</span></div>
          {!areas ? <p className="ad-muted">Loading…</p> : (
            <div className="ow-areas">
              {areas.map((a) => (
                <button key={a.name} className={`ow-area ${a.on ? 'on' : ''}`} aria-pressed={a.on} onClick={() => toggleArea(a)}>
                  <span className="ow-dot" aria-hidden="true" />{a.name}<em>{a.stores} store{a.stores === 1 ? '' : 's'}</em>
                </button>
              ))}
            </div>
          )}
          <p className="ad-muted ad-small" style={{ marginTop: 12 }}>Areas come from your stores. When an area is off, its stores are hidden from customers (rain, strike, no riders…). Turn it back on any time.</p>
        </section>

        <section className="ad-card">
          <div className="ad-card-head"><h2>Offers</h2><span className="ad-muted ad-small">{coupons ? `${coupons.filter((c) => c.active).length} running` : ''}</span></div>
          {!coupons ? <p className="ad-muted">Loading…</p> : coupons.length === 0 ? <p className="ad-muted">No offers yet.</p> : (
            <div className="ow-offers">
              {coupons.map((c) => {
                const ended = c.ends_at && new Date(c.ends_at) < new Date()
                return (
                  <div key={c.id} className={`ow-offer ${c.active && !ended ? '' : 'off'}`}>
                    <code>{c.code}</code>
                    <div><b>{c.title}</b><span>{offerText(c)} · used {c.used || 0} times{c.ends_at ? ` · till ${new Date(c.ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}</span></div>
                    {ended ? <span className="ad-badge grey">Ended</span> : (
                      <button className={`ad-mini-switch ${c.active ? 'on' : ''}`} role="switch" aria-checked={c.active} aria-label={`${c.code} running`} onClick={() => toggleCoupon(c)}><span /></button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
      <DeliveryCharges />
      {adding && <NewOffer onClose={() => setAdding(false)} onSaved={(c) => { setCoupons((xs) => [c, ...(xs || [])]); setAdding(false) }} />}
    </>
  )
}
