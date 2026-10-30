import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Headset } from 'lucide-react'
import { api } from '../../shared/api/client.js'
import { PageHead, Empty, ErrorNote } from '../../admin/components/ui.jsx'
import { asDate } from '../../admin/utils/format.js'

export default function SupportTeam() {
  const [items, setItems] = useState(null)
  const [f, setF] = useState({ name: '', phone: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.get('/api/owner/support-team').then(setItems).catch((e) => setError(e.message)) }, [])

  const add = async (e) => {
    e.preventDefault()
    if (f.name.trim().length < 2) return setError('Enter their name.')
    if (!/^[6-9]\d{9}$/.test(f.phone)) return setError('Enter a valid 10-digit mobile number.')
    setBusy(true); setError('')
    try {
      const a = await api.post('/api/owner/support-team', { name: f.name.trim(), phone: f.phone })
      setItems((xs) => [...(xs || []), a]); setF({ name: '', phone: '' })
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const toggle = async (a) => {
    try {
      const r = await api.patch(`/api/owner/users/${a.id}`, { is_active: !a.is_active })
      setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, is_active: r.is_active } : x)))
    } catch (err) { setError(err.message) }
  }

  return (
    <>
      <PageHead title="Support team" sub="People who handle complaints, cancellations, substitutions, refunds and late orders for every store. They log in with their mobile number and the support inbox opens.">
        <Link className="ad-btn ghost" to="/support">Open the support inbox</Link>
      </PageHead>
      <form className="ad-card ow-addrow" onSubmit={add} noValidate>
        <label className="ad-field">Name<input className="ad-input" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} placeholder="eg. Divya" /></label>
        <label className="ad-field">Mobile<input className="ad-input" inputMode="numeric" value={f.phone} onChange={(e) => setF((s) => ({ ...s, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10-digit number" /></label>
        <button className="ad-btn" disabled={busy}>{busy ? 'Adding…' : 'Add to team'}</button>
      </form>
      <ErrorNote>{error}</ErrorNote>
      {!items ? <p className="ad-muted">Loading…</p> : items.length === 0 ? (
        <Empty icon={Headset} title="No support agents yet" text="Until you add someone, you can answer tickets yourself from the support inbox." />
      ) : (
        <div className="ad-card flush"><div className="ad-table-wrap"><table className="ad-table">
          <thead><tr><th>Name</th><th>Mobile</th><th>Last login</th><th>Login allowed</th></tr></thead>
          <tbody>{items.map((a) => (
            <tr key={a.id} className={a.is_active ? '' : 'dim'}>
              <td><b>{a.name}</b></td><td>+91 {a.phone}</td>
              <td>{a.last_login_at ? asDate(a.last_login_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not yet'}</td>
              <td><button className={`ad-mini-switch ${a.is_active ? 'on' : ''}`} role="switch" aria-checked={a.is_active} aria-label={`${a.name} can log in`} onClick={() => toggle(a)}><span /></button></td>
            </tr>
          ))}</tbody>
        </table></div></div>
      )}
    </>
  )
}
