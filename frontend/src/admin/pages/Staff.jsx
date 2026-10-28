import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Users, Check, X, Bike } from 'lucide-react'
import { api } from '../../shared/api/client.js'
import { resolveImage } from '../../shared/utils/images.js'
import { Empty, ErrorNote, Modal, PageHead } from '../components/ui.jsx'

const ROLES = { manager: 'Manager', picker: 'Picker', packer: 'Packer', cashier: 'Cashier', delivery: 'Delivery (own rider)' }
const SHIFTS = ['Morning', 'Evening', 'Night', 'Full day']
const EMPTY = { name: '', phone: '', email: '', role: 'picker', shift: 'Morning', password: '', vehicle_number: '' }

function StaffForm({ initial, onSaved, onClose }) {
  const editing = Boolean(initial?.id)
  const [f, setF] = useState(editing ? { ...EMPTY, ...initial, email: initial.email || '' } : EMPTY)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF(s => ({ ...s, [k]: k === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (f.name.trim().length < 2) return setError('Enter the staff member\'s name.')
    if (!/^[6-9]\d{9}$/.test(f.phone)) return setError('Enter a valid 10-digit mobile number.')
    const rider = f.role === 'delivery' && !editing
    const body = { name: f.name.trim(), phone: f.phone, email: f.email.trim() || null, role: f.role, shift: f.shift }
    if (rider) Object.assign(body, { vehicle_number: f.vehicle_number.trim() || null })
    setBusy(true); setError('')
    try {
      onSaved(editing ? await api.put(`/api/admin/staff/${initial.id}`, body) : await api.post('/api/admin/staff', body), editing)
    } catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <Modal title={editing ? 'Edit staff member' : 'Add staff member'} onClose={onClose}>
      <form className="ad-form" onSubmit={submit} noValidate>
        <label className="ad-field full">Name<input className="ad-input" value={f.name} onChange={set('name')} autoFocus /></label>
        <label className="ad-field">Mobile<input className="ad-input" inputMode="numeric" value={f.phone} onChange={set('phone')} /></label>
        <label className="ad-field">Email (optional)<input className="ad-input" type="email" value={f.email} onChange={set('email')} disabled={editing && f.role === 'delivery'} /></label>
        <label className="ad-field">Role
          <select className="ad-input" value={f.role} onChange={set('role')} disabled={editing && initial.role === 'delivery'}>{Object.entries(ROLES).filter(([k]) => !editing || initial.role === 'delivery' || k !== 'delivery').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        {f.role === 'delivery' && !editing && (
          <>
            <label className="ad-field">Vehicle number (optional)<input className="ad-input" value={f.vehicle_number} onChange={set('vehicle_number')} placeholder="TN09AB1234" /></label>
            <p className="ad-od-note full">They log in to FreshMart with this mobile number (OTP), no password needed. They only get your store’s orders, and customers see them live on the map.</p>
          </>
        )}
        <label className="ad-field">Shift
          <select className="ad-input" value={f.shift} onChange={set('shift')}>{SHIFTS.map(s => <option key={s}>{s}</option>)}</select>
        </label>
        <div className="full"><ErrorNote>{error}</ErrorNote></div>
        <div className="ad-form-actions full">
          <button type="button" className="ad-btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="ad-btn" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save' : 'Add staff'}</button>
        </div>
      </form>
    </Modal>
  )
}

const ago = (iso) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso)) / 60000))
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`
}
const VEH = { bike: 'Bike', scooter: 'Scooter', cycle: 'Cycle' }

function RiderRequests({ items, onDecided }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const decide = async (r, approve) => {
    if (!approve && !window.confirm(`Reject ${r.name}'s request?`)) return
    setBusy(r.id); setError('')
    try { onDecided(await api.post(`/api/admin/rider-requests/${r.id}/${approve ? 'approve' : 'reject'}`)) }
    catch (e) { setError(e.message) }
    finally { setBusy('') }
  }
  if (!items.length) return <Empty icon={Bike} title="No new requests" text="People who tap “Join as a delivery partner” in the app show up here for you to approve." />
  return (
    <>
      <ErrorNote>{error}</ErrorNote>
      <div className="ad-req-grid">
        {items.map(r => {
          const photo = resolveImage(r.licence?.photo)
          return (
            <section key={r.id} className={`ad-card ad-rreq ${r.status}`}>
              <div className="ad-rreq-head">
                <span className="ad-rreq-av" aria-hidden="true">{(r.name || '?')[0].toUpperCase()}</span>
                <div><b>{r.name}</b><span className="ad-muted ad-small">+91 {r.phone} · asked {ago(r.created_at)}</span></div>
                <span className={`ad-rreq-pill ${r.status}`}>{r.status === 'pending' ? 'Waiting' : r.status === 'active' ? 'Approved' : 'Rejected'}</span>
              </div>
              <dl className="ad-rreq-facts">
                <div><dt>Vehicle</dt><dd>{VEH[r.vehicle?.type] || r.vehicle?.type}{r.vehicle?.number ? ` · ${r.vehicle.number}` : ''}</dd></div>
                <div><dt>Area</dt><dd>{r.area || '—'}</dd></div>
                <div><dt>Licence no.</dt><dd>{r.licence?.number || '—'}</dd></div>
                <div><dt>Licence photo</dt><dd>{photo ? <a href={photo} target="_blank" rel="noreferrer">View photo</a> : 'Not added'}</dd></div>
              </dl>
              {r.status === 'pending' ? (
                <div className="ad-rreq-actions">
                  <button className="ad-btn ghost danger" disabled={busy === r.id} onClick={() => decide(r, false)}><X size={16} /> Reject</button>
                  <button className="ad-btn" disabled={busy === r.id} onClick={() => decide(r, true)}><Check size={16} /> Approve</button>
                </div>
              ) : (
                <p className="ad-muted ad-small">{r.status === 'active' ? 'Approved. They got an SMS and can log in with their number.' : 'Rejected. They got an SMS.'}</p>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}

export default function Staff() {
  const [items, setItems]     = useState(null)
  const [error, setError]     = useState('')
  const [editing, setEditing] = useState(null)

  const [tab, setTab]         = useState('team')
  const [reqs, setReqs]       = useState([])

  const load = useCallback(() => api.get('/api/admin/staff').then(setItems).catch(e => setError(e.message)), [])
  const loadReqs = useCallback(() => api.get('/api/admin/rider-requests').then(setReqs).catch(() => {}), [])
  useEffect(() => { load(); loadReqs() }, [load, loadReqs])
  const pending = reqs.filter(r => r.status === 'pending').length
  const onDecided = (r) => setReqs(xs => xs.map(x => x.id === r.id ? r : x))

  const onSaved = (s, wasEdit) => { setItems(xs => wasEdit ? xs.map(x => x.id === s.id ? s : x) : [s, ...xs]); setEditing(null) }
  const toggle = async (s) => {
    const n = await api.put(`/api/admin/staff/${s.id}`, { is_active: !s.is_active })
    setItems(xs => xs.map(x => x.id === n.id ? n : x))
  }
  const remove = async (s) => {
    if (!window.confirm(`Remove ${s.name} from your staff?`)) return
    await api.del(`/api/admin/staff/${s.id}`)
    setItems(xs => xs.filter(x => x.id !== s.id))
  }

  return (
    <>
      <PageHead title="Staff" sub="People working at your store, and delivery partners who asked to join. Everyone logs in with their mobile number.">
        <button className="ad-btn" onClick={() => setEditing({})}><Plus size={16} /> Add staff</button>
      </PageHead>
      <div className="ad-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'team'} className={`ad-tab ${tab === 'team' ? 'on' : ''}`} onClick={() => setTab('team')}>Our team{items && <span className="ad-tab-n">{items.length}</span>}</button>
        <button role="tab" aria-selected={tab === 'req'} className={`ad-tab ${tab === 'req' ? 'on' : ''}`} onClick={() => setTab('req')}>New delivery partners{pending > 0 && <span className="ad-tab-n hot">{pending}</span>}</button>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {tab === 'req' ? <RiderRequests items={reqs} onDecided={onDecided} /> : !items ? <p className="ad-muted">Loading…</p> : items.length === 0 ? (
        <Empty icon={Users} title="No staff added yet" text="Add the people who pick and pack orders at your store." />
      ) : (
        <div className="ad-card flush">
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead><tr><th>Name</th><th>Role</th><th>Shift</th><th>Contact</th><th>Active</th><th /></tr></thead>
              <tbody>
                {items.map(s => (
                  <tr key={s.id} className={s.is_active ? '' : 'dim'}>
                    <td><b>{s.name}</b></td>
                    <td>{ROLES[s.role] || s.role}{s.user_id && <span className="ad-ex-tag">APP LOGIN</span>}</td>
                    <td>{s.shift}</td>
                    <td><span>+91 {s.phone}</span>{s.email && <span className="ad-muted ad-block">{s.email}</span>}</td>
                    <td><button className={`ad-mini-switch ${s.is_active ? 'on' : ''}`} role="switch" aria-checked={s.is_active} aria-label={`Active: ${s.name}`} onClick={() => toggle(s)}><span /></button></td>
                    <td className="ad-row-actions">
                      <button className="ad-icon-btn" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}><Pencil size={16} /></button>
                      <button className="ad-icon-btn danger" aria-label={`Remove ${s.name}`} onClick={() => remove(s)}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {editing && <StaffForm initial={editing} onSaved={onSaved} onClose={() => setEditing(null)} />}
    </>
  )
}
