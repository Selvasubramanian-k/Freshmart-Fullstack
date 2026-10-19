import { useEffect, useState } from 'react'
import { api } from '../../shared/api/client.js'
import { ErrorNote, PageHead } from '../components/ui.jsx'

const STORE_TYPES = ['Grocery', 'Supermarket', 'Fruits & Vegetables', 'Dairy', 'Meat & Fish', 'Organic', 'Pet store']

export default function StoreSettings({ onSaved }) {
  const [f, setF]         = useState(null)
  const [error, setError] = useState('')
  const [msg, setMsg]     = useState('')
  const [busy, setBusy]   = useState(false)

  useEffect(() => {
    api.get('/api/admin/store').then(s => setF({
      name: s.name, category: s.category, gst_number: s.gst_number || '',
      open_time: s.open_time, close_time: s.close_time, delivery_radius_km: String(s.delivery_radius_km ?? 5),
      line1: s.address.line1, landmark: s.address.landmark || '', city: s.address.city, state: s.address.state, pincode: s.address.pincode,
    })).catch(e => setError(e.message))
  }, [])

  if (!f) return error ? <ErrorNote>{error}</ErrorNote> : <p className="ad-muted">Loading…</p>

  const set = (k) => (e) => { setF(s => ({ ...s, [k]: e.target.value })); setMsg('') }

  const submit = async (e) => {
    e.preventDefault()
    if (f.open_time >= f.close_time) return setError('Closing time must be after opening time.')
    if (!/^\d{6}$/.test(f.pincode)) return setError('Pincode must be 6 digits.')
    setBusy(true); setError(''); setMsg('')
    try {
      const s = await api.put('/api/admin/store', {
        name: f.name.trim(), category: f.category, gst_number: f.gst_number.trim().toUpperCase() || null,
        open_time: f.open_time, close_time: f.close_time, delivery_radius_km: Number(f.delivery_radius_km) || 5,
        address: { line1: f.line1.trim(), landmark: f.landmark.trim() || null, city: f.city.trim(), state: f.state, pincode: f.pincode },
      })
      onSaved?.(s)
      setMsg('Store details saved.')
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <>
      <PageHead title="Store settings" sub="Use the switch at the top to open or close your store for customers." />
      <form className="ad-card ad-form" onSubmit={submit} noValidate>
        <p className="ad-form-sec full">Store</p>
        <label className="ad-field full">Store name<input className="ad-input" value={f.name} onChange={set('name')} /></label>
        <label className="ad-field">Store type
          <select className="ad-input" value={f.category} onChange={set('category')}>{STORE_TYPES.map(t => <option key={t}>{t}</option>)}</select>
        </label>
        <label className="ad-field">GST number<input className="ad-input" value={f.gst_number} onChange={set('gst_number')} maxLength={15} /></label>
        <label className="ad-field">Opens at<input className="ad-input" type="time" value={f.open_time} onChange={set('open_time')} /></label>
        <label className="ad-field">Closes at<input className="ad-input" type="time" value={f.close_time} onChange={set('close_time')} /></label>
        <label className="ad-field">Delivery radius (km)<input className="ad-input" inputMode="decimal" value={f.delivery_radius_km} onChange={set('delivery_radius_km')} /></label>

        <p className="ad-form-sec full">Address</p>
        <label className="ad-field full">Street address<input className="ad-input" value={f.line1} onChange={set('line1')} /></label>
        <label className="ad-field">Landmark<input className="ad-input" value={f.landmark} onChange={set('landmark')} /></label>
        <label className="ad-field">City<input className="ad-input" value={f.city} onChange={set('city')} /></label>
        <label className="ad-field">State<input className="ad-input" value={f.state} onChange={set('state')} /></label>
        <label className="ad-field">Pincode<input className="ad-input" inputMode="numeric" value={f.pincode} onChange={set('pincode')} maxLength={6} /></label>

        <div className="full"><ErrorNote>{error}</ErrorNote>{msg && <p className="ad-ok">{msg}</p>}</div>
        <div className="ad-form-actions full"><button className="ad-btn" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </>
  )
}
