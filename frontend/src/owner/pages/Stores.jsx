import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Store } from 'lucide-react'
import { api } from '../../shared/api/client.js'
import { PageHead, Modal, Empty, ErrorNote } from '../../admin/components/ui.jsx'

const STATUS = { active: ['Open', 'green'], disabled: ['Turned off', 'grey'], pending: ['Waiting approval', 'amber'], rejected: ['Rejected', 'red'] }
const EMPTY = { owner_name: '', phone: '', store_name: '', line1: '', area: '', city: 'Chennai', pincode: '', gst_number: '', commission_pct: '' }

function AddStore({ onSaved, onClose }) {
  const [f, setF] = useState(EMPTY)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => {
    let v = e.target.value
    if (k === 'phone') v = v.replace(/\D/g, '').slice(0, 10)
    if (k === 'pincode') v = v.replace(/\D/g, '').slice(0, 6)
    setF((s) => ({ ...s, [k]: v }))
  }
  const submit = async (e) => {
    e.preventDefault()
    if (f.owner_name.trim().length < 2) return setError('Enter the owner’s name.')
    if (!/^[6-9]\d{9}$/.test(f.phone)) return setError('Enter a valid 10-digit mobile number.')
    if (f.store_name.trim().length < 2) return setError('Enter the store name.')
    if (f.line1.trim().length < 3) return setError('Enter the shop address.')
    if (f.area.trim().length < 2) return setError('Enter the area (eg. Velachery).')
    if (!/^\d{6}$/.test(f.pincode)) return setError('Enter the 6-digit pincode.')
    setBusy(true); setError('')
    try {
      onSaved(await api.post('/api/owner/stores', {
        ...f, owner_name: f.owner_name.trim(), store_name: f.store_name.trim(), gst_number: f.gst_number.trim() || null,
        commission_pct: f.commission_pct === '' ? null : Number(f.commission_pct),
      }))
    } catch (err) { setError(err.message); setBusy(false) }
  }
  return (
    <Modal title="Add a store" onClose={onClose} wide>
      <form className="ad-form" onSubmit={submit} noValidate>
        <p className="ad-form-sec full">Owner</p>
        <label className="ad-field">Owner name<input className="ad-input" value={f.owner_name} onChange={set('owner_name')} autoFocus /></label>
        <label className="ad-field">Owner mobile (they log in with this)<input className="ad-input" inputMode="numeric" value={f.phone} onChange={set('phone')} placeholder="10-digit number" /></label>
        <p className="ad-form-sec full">Store</p>
        <label className="ad-field">Store name<input className="ad-input" value={f.store_name} onChange={set('store_name')} placeholder="eg. Kannan Stores" /></label>
        <label className="ad-field">Area<input className="ad-input" value={f.area} onChange={set('area')} placeholder="eg. Velachery" /></label>
        <label className="ad-field full">Shop address<input className="ad-input" value={f.line1} onChange={set('line1')} placeholder="Door no, street" /></label>
        <label className="ad-field">City<input className="ad-input" value={f.city} onChange={set('city')} /></label>
        <label className="ad-field">Pincode<input className="ad-input" inputMode="numeric" value={f.pincode} onChange={set('pincode')} /></label>
        <label className="ad-field">GST number (optional)<input className="ad-input" value={f.gst_number} onChange={set('gst_number')} /></label>
        <label className="ad-field">Commission % (empty = default)<input className="ad-input" inputMode="decimal" value={f.commission_pct} onChange={set('commission_pct')} placeholder="10" /></label>
        <p className="ad-od-note full" style={{ background: '#e6f4ee', color: '#005c3c' }}>The owner gets an SMS. They open FreshMart, enter this number and the OTP, and their store dashboard opens.</p>
        {error && <p className="ad-error full" role="alert">{error}</p>}
        <div className="ad-form-actions full">
          <button type="button" className="ad-btn ghost" onClick={onClose}>Cancel</button>
          <button className="ad-btn" disabled={busy}>{busy ? 'Adding…' : 'Add store'}</button>
        </div>
      </form>
    </Modal>
  )
}

function Commission({ s, onSaved }) {
  const [v, setV] = useState(String(s.commission_pct))
  const [busy, setBusy] = useState(false)
  const save = async () => {
    const n = Number(v)
    if (v === '' || Number.isNaN(n) || n < 0 || n > 50 || n === s.commission_pct) { setV(String(s.commission_pct)); return }
    setBusy(true)
    try { onSaved(await api.patch(`/api/owner/stores/${s.id}`, { commission_pct: n })) } finally { setBusy(false) }
  }
  return (
    <span className="ow-pct">
      <input className="ad-input sm" inputMode="decimal" aria-label={`Commission % for ${s.name}`} value={v} disabled={busy}
        onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))} onBlur={save} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />%
    </span>
  )
}

export default function Stores() {
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(params.get('add') === '1')
  const [q, setQ] = useState('')

  const load = useCallback(() => api.get('/api/owner/stores').then(setItems).catch((e) => setError(e.message)), [])
  useEffect(() => { load() }, [load])
  const replace = (s) => setItems((xs) => xs.map((x) => (x.id === s.id ? { ...x, ...s, orders_7d: x.orders_7d } : x)))
  const toggle = async (s) => {
    setError('')
    try { replace(await api.patch(`/api/owner/stores/${s.id}`, { enabled: s.status !== 'active' })) } catch (e) { setError(e.message) }
  }
  const decide = async (s, yes) => {
    try { replace(await api.patch(`/api/owner/stores/${s.id}`, { approve: yes })) } catch (e) { setError(e.message) }
  }
  const close = () => { setAdding(false); if (params.get('add')) setParams({}, { replace: true }) }
  const shown = (items || []).filter((s) => !q || `${s.name} ${s.area} ${s.owner?.name} ${s.owner?.phone}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <PageHead title="Stores" sub="Add a store here. The owner then logs in with their mobile number and the store dashboard opens. Turn a store off to hide it from customers.">
        <button className="ad-btn" onClick={() => setAdding(true)}>+ Add store</button>
      </PageHead>
      <ErrorNote>{error}</ErrorNote>
      <input className="ad-input ow-search" placeholder="Search store, area, owner or number" aria-label="Search stores" value={q} onChange={(e) => setQ(e.target.value)} />
      {!items ? <p className="ad-muted">Loading…</p> : items.length === 0 ? (
        <Empty icon={Store} title="No stores yet" text="Add the first store to open FreshMart in an area." />
      ) : (
        <div className="ad-card flush"><div className="ad-table-wrap"><table className="ad-table">
          <thead><tr><th>Store</th><th>Owner</th><th>Area</th><th>Orders (7 days)</th><th>Commission</th><th>Status</th><th>On / off</th></tr></thead>
          <tbody>
            {shown.map((s) => {
              const [label, tone] = STATUS[s.status] || [s.status, 'grey']
              return (
                <tr key={s.id} className={s.status === 'active' ? '' : 'dim'}>
                  <td><b>{s.name}</b><span className="ad-muted ad-block ad-small">{s.address}</span></td>
                  <td>{s.owner?.name || '—'}<span className="ad-muted ad-block ad-small">{s.owner ? `+91 ${s.owner.phone}` : ''}</span></td>
                  <td>{s.area || '—'}</td>
                  <td>{s.orders_7d}</td>
                  <td><Commission s={s} onSaved={replace} /></td>
                  <td><span className={`ad-badge ${tone}`}>{label}</span>{s.status === 'active' && !s.is_open && <span className="ad-muted ad-block ad-small">Closed by owner now</span>}</td>
                  <td>
                    {s.status === 'pending' ? (
                      <span className="ow-row-btns"><button className="ad-btn sm" onClick={() => decide(s, true)}>Approve</button><button className="ad-btn ghost sm" onClick={() => decide(s, false)}>Reject</button></span>
                    ) : (
                      <button className={`ad-mini-switch ${s.status === 'active' ? 'on' : ''}`} role="switch" aria-checked={s.status === 'active'} aria-label={`${s.name} on`} onClick={() => toggle(s)}><span /></button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table></div></div>
      )}
      {adding && <AddStore onClose={close} onSaved={(s) => { setItems((xs) => [...(xs || []), s]); close() }} />}
    </>
  )
}
