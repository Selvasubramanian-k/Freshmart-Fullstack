import { useEffect, useState } from 'react'
import { api } from '../../shared/api/client.js'
import { PageHead, ErrorNote } from '../../admin/components/ui.jsx'

const ROLES = [['', 'Everyone'], ['customer', 'Customers'], ['admin', 'Store owners'], ['delivery', 'Delivery partners'],
  ['picker', 'Pickers'], ['support', 'Support'], ['superadmin', 'Owners']]
const ROLE_NAME = Object.fromEntries(ROLES.filter(([k]) => k))
const when = (iso) => (iso ? new Date(/Z$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

export default function Users() {
  const [role, setRole] = useState('')
  const [q, setQ] = useState('')
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams(); if (role) p.set('role', role); if (q.trim()) p.set('q', q.trim())
      api.get(`/api/owner/users?${p}`).then(setItems).catch((e) => setError(e.message))
    }, 250)
    return () => clearTimeout(t)
  }, [role, q])

  const toggle = async (u) => {
    if (u.is_active && !window.confirm(`Block ${u.name || u.phone}? They won’t be able to log in.`)) return
    setError('')
    try {
      const r = await api.patch(`/api/owner/users/${u.id}`, { is_active: !u.is_active })
      setItems((xs) => xs.map((x) => (x.id === u.id ? { ...x, is_active: r.is_active } : x)))
    } catch (e) { setError(e.message) }
  }

  return (
    <>
      <PageHead title="Users" sub="Everyone on FreshMart. Block a user to stop their login right away." />
      <ErrorNote>{error}</ErrorNote>
      <div className="ow-filter">
        <div className="ad-tabs compact" role="tablist">
          {ROLES.map(([k, label]) => <button key={k} role="tab" aria-selected={role === k} className={`ad-tab ${role === k ? 'on' : ''}`} onClick={() => setRole(k)}>{label}</button>)}
        </div>
        <input className="ad-input ow-search" placeholder="Search name or number" aria-label="Search users" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!items ? <p className="ad-muted">Loading…</p> : (
        <div className="ad-card flush"><div className="ad-table-wrap"><table className="ad-table">
          <thead><tr><th>Name</th><th>Mobile</th><th>Role</th><th>Store</th><th>Joined</th><th>Last login</th><th>Login allowed</th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={7} className="ad-muted">No one found.</td></tr>}
            {items.map((u) => (
              <tr key={u.id} className={u.is_active ? '' : 'dim'}>
                <td><b>{u.name || 'No name yet'}</b>{u.status !== 'active' && <span className="ad-badge amber" style={{ marginLeft: 6 }}>{u.status}</span>}</td>
                <td>{u.phone ? `+91 ${u.phone}` : '—'}</td>
                <td>{ROLE_NAME[u.role] || u.role}</td>
                <td>{u.store || '—'}</td>
                <td>{when(u.created_at)}</td>
                <td>{when(u.last_login_at)}</td>
                <td>{u.role === 'superadmin' ? <span className="ad-muted ad-small">from .env</span> : (
                  <button className={`ad-mini-switch ${u.is_active ? 'on' : ''}`} role="switch" aria-checked={u.is_active} aria-label={`${u.name || u.phone} can log in`} onClick={() => toggle(u)}><span /></button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}
    </>
  )
}
