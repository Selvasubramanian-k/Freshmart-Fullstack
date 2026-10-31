import { useCallback, useEffect, useState } from 'react'
import { api } from '../../shared/api/client.js'
import { useAuth } from '../../shared/context/AuthContext.jsx'
import LiveMap from '../../shared/map/LiveMap.jsx'
import { distanceKm, fmtKm, hasPoint } from '../../shared/map/geo.js'
import { useRider } from '../RiderContext.jsx'
import Task from './Task.jsx'
import PaySplit from '../PaySplit.jsx'

const rs = (n) => `₹${Math.round(n)}`

function TaskCard({ t, pos, onAccept, busy }) {
  const toStore = hasPoint(pos) && hasPoint(t.store) ? distanceKm(pos, t.store) : null
  const storeToDrop = hasPoint(t.store) && hasPoint(t.drop) ? distanceKm(t.store, t.drop) * 1.3 : null
  return (
    <article className="rd-task">
      <div className="rd-task-top">
        <div>
          <span className="rd-kicker amber">{t.is_exchange ? 'Exchange delivery' : 'New delivery'}</span>
          <div className="rd-earn">{rs(t.earning)} <small>you earn</small></div>
          <PaySplit pay={t.pay} />
        </div>
        <span className={`rd-chip ${t.status === 'packed' ? 'green' : ''}`}>{t.status === 'packed' ? 'Packed, ready' : 'Store packing'}</span>
      </div>
      <div className="rd-legs">
        <div className="rd-leg-line"><span className="dot store" /><span className="dash" /><span className="dot home" /></div>
        <div className="rd-leg-text">
          <div>
            <small>PICKUP{toStore !== null ? ` · ${fmtKm(toStore)}` : ''}</small>
            <b>{t.store.name}</b>
            <span>{t.store.text}</span>
          </div>
          <div>
            <small>DROP{storeToDrop !== null ? ` · ${fmtKm(storeToDrop)}` : ''}</small>
            <b>{t.drop.label}</b>
            <span>{t.drop.text}</span>
          </div>
        </div>
      </div>
      <div className="rd-tags">
        <span>{t.items_count} items</span>
        {t.is_exchange ? <span className="amber">Bring old item back</span> : t.cod_amount > 0 ? <span className="amber">Collect {rs(t.cod_amount)} cash</span> : <span>Prepaid</span>}
        <span>#{t.order_number}</span>
      </div>
      <button className="rd-btn" disabled={busy} onClick={() => onAccept(t.id)}>{busy ? 'Accepting…' : 'Accept delivery'}</button>
    </article>
  )
}

export default function Home() {
  const { user } = useAuth()
  const { me, refreshMe, setOnline, pos, gpsError } = useRider()
  const [tasks, setTasks] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [toggling, setToggling] = useState(false)

  const loadTasks = useCallback(() => api.get('/api/delivery/tasks/available').then(setTasks).catch((e) => setError(e.message)), [])

  useEffect(() => {
    if (!me?.is_online || me.active_order_id) return
    loadTasks()
    const t = setInterval(loadTasks, 8000)
    return () => clearInterval(t)
  }, [me?.is_online, me?.active_order_id, loadTasks])

  const toggle = async () => {
    setToggling(true); setError('')
    try { await setOnline(!me.is_online) } catch (e) { setError(e.message) } finally { setToggling(false) }
  }

  const accept = async (id) => {
    setBusy(id); setError('')
    try { await api.post(`/api/delivery/tasks/${id}/accept`); await refreshMe() }
    catch (e) { setError(e.message); loadTasks() }
    finally { setBusy('') }
  }

  if (!me) return <div className="rd-center">Loading…</div>
  if (me.active_order_id) return <Task onDone={refreshMe} />

  const pins = tasks.filter((t) => hasPoint(t.store)).map((t) => ({ id: t.id, kind: 'store', lat: t.store.lat, lng: t.store.lng }))

  return (
    <div className="rd-home">
      <div className="rd-map">
        <LiveMap zoomPosition="topright" rider={me.is_online ? pos : null} places={pins} fitKey={`home-${pins.length}-${hasPoint(pos)}`} />
      </div>

      <div className="rd-topbar">
        <span className="rd-avatar">{(user?.name || 'R').charAt(0).toUpperCase()}</span>
        <button className={`rd-online ${me.is_online ? 'on' : ''}`} onClick={toggle} disabled={toggling} role="switch" aria-checked={me.is_online}>
          {me.is_online ? "You're online" : "You're offline"}
          <span className="rd-switch" />
        </button>
      </div>

      <section className="rd-sheet">
        <span className="rd-grip" />
        {error && <p className="rd-error">{error}</p>}
        {me.is_online && gpsError && <p className="rd-warn">{gpsError} You can still take orders; use "Demo drive" on the map to test.</p>}

        {!me.is_online ? (
          <div className="rd-empty">
            <b>Go online to get deliveries</b>
            <span>Turn on the switch above when you're ready to ride.</span>
            <button className="rd-btn" onClick={toggle} disabled={toggling}>Go online</button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="rd-empty">
            <span className="rd-radar" aria-hidden="true" />
            <b>Looking for deliveries near you…</b>
            <span>New orders show up here as soon as a store accepts them.</span>
          </div>
        ) : (
          <div className="rd-task-list">
            {tasks.map((t) => <TaskCard key={t.id} t={t} pos={pos} onAccept={accept} busy={busy === t.id} />)}
          </div>
        )}
      </section>
    </div>
  )
}
