import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../shared/context/AuthContext.jsx'
import { useRider } from '../RiderContext.jsx'

const VEHICLE = { bike: 'Bike', scooter: 'Scooter', cycle: 'Cycle' }

export default function Profile() {
  const { user, logout } = useAuth()
  const { me, setOnline } = useRider()
  const navigate = useNavigate()

  const doLogout = async () => {
    if (me?.is_online && !me.active_order_id) { try { await setOnline(false) } catch { /* ignore */ } }
    logout()
    navigate('/login')
  }

  return (
    <div className="rd-page">
      <header className="rd-profile-head">
        <span className="rd-avatar big">{(user?.name || 'R').charAt(0).toUpperCase()}</span>
        <h1>{user?.name}</h1>
        <span>Delivery partner · {user?.city || 'FreshMart'}</span>
      </header>
      <section className="rd-card">
        <div className="rd-line"><span>Mobile</span><b>+91 {user?.phone}</b></div>
        {user?.email && <div className="rd-line"><span>Email</span><b>{user.email}</b></div>}
        <div className="rd-line"><span>Vehicle</span><b>{VEHICLE[user?.vehicle?.type] || '—'} {user?.vehicle?.number}</b></div>
        <div className="rd-line"><span>Status</span><b className={me?.is_online ? 'ok' : ''}>{me?.is_online ? 'Online' : 'Offline'}</b></div>
      </section>
      {me?.active_order_id && <p className="rd-warn">Finish your current delivery before logging out.</p>}
      <button className="rd-btn ghost" onClick={doLogout} disabled={Boolean(me?.active_order_id)}><LogOut size={18} /> Log out</button>
    </div>
  )
}
