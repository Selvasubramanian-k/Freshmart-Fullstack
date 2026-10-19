import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { api } from '../../shared/api/client.js'

// Stores -> backend la irundhu (store owners register panna automatic ah inga varum)
const to12h = (t) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'AM' : 'PM'}`
}

export default function Shops() {
  const navigate = useNavigate()
  const [stores, setStores] = useState(null)
  const [error, setError]   = useState('')

  useEffect(() => {
    api.get('/api/stores').then(setStores).catch(e => setError(e.message))
  }, [])

  return (
    <div className="page-wrapper">
      <button className="page-back" onClick={() => navigate('/')}>← Back</button>
      <h1 className="page-title"><Icon name="store" /> Our Shops</h1>
      {error && <p className="login-error">{error}</p>}
      {!stores && !error && <p className="acc-muted">Loading shops…</p>}
      <div className="shops-grid">
        {stores?.map((s) => (
          <div key={s.id} className="shop-card">
            <p className="shop-card-name">{s.name}</p>
            <p className="shop-card-info"><Icon name="map-pin" /> {s.address?.line1}, {s.address?.city}</p>
            <p className="shop-card-info"><Icon name="clock" /> {to12h(s.open_time)} - {to12h(s.close_time)}</p>
            <p className={`shop-card-status ${s.is_open ? 'open' : 'closed'}`}>{s.is_open ? 'Open now' : 'Closed'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
