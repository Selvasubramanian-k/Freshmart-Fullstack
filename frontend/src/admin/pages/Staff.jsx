import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import { api } from '../../shared/api/client.js'
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
    if (rider && !/^\S+@\S+\.\S+$/.test(f.email.trim())) return setError('Delivery staff log in with an email. Enter their email.')
    if (rider && f.password.length < 6) return setError('Set a password of at least 6 characters for the delivery app.')
    const body = { name: f.name.trim(), phone: f.phone, email: f.email.trim() || null, role: f.role, shift: f.shift }
    if (rider) Object.assign(body, { password: f.password, vehicle_number: f.vehicle_number.trim() || null })
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
        <label className="ad-field">{f.role === 'delivery' ? 'Email (their login)' : 'Email (optional)'}<input className="ad-input" type="email" value={f.email} onChange={set('email')} disabled={editing && f.role === 'delivery'} /></label>
        <label className="ad-field">Role
          <select className="ad-input" value={f.role} onChange={set('role')} disabled={editing && initial.role === 'delivery'}>{Object.entries(ROLES).filter(([k]) => !editing || initial.role === 'delivery' || k !== 'delivery').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        {f.role === 'delivery' && !editing && (
          <>
            <label className="ad-field">Password for the delivery app<input className="ad-input" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} /></label>
            <label className="ad-field">Vehicle number (optional)<input className="ad-input" value={f.vehicle_number} onChange={set('vehicle_number')} placeholder="TN09AB1234" /></label>
            <p className="ad-od-note full">They log in to the FreshMart delivery app with this email and password. They only get your store’s orders, and customers see them live on the map.</p>
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

export default function Staff() {
  const [items, setItems]     = useState(null)
  const [error, setError]     = useState('')
  const [editing, setEditing] = useState(null)

  const load = useCallback(() => api.get('/api/admin/staff').then(setItems).catch(e => setError(e.message)), [])
  useEffect(() => { load() }, [load])

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
      <PageHead title="Staff" sub="People working at your store. Delivery staff get a login for the delivery app so customers can track them live.">
        <button className="ad-btn" onClick={() => setEditing({})}><Plus size={16} /> Add staff</button>
      </PageHead>
      <ErrorNote>{error}</ErrorNote>
      {!items ? <p className="ad-muted">Loading…</p> : items.length === 0 ? (
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
