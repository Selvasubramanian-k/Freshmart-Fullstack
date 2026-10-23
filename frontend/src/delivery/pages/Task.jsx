import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Phone, Navigation, CornerUpRight, CornerUpLeft, ArrowUp, Check } from 'lucide-react'
import { api } from '../../shared/api/client.js'
import LiveMap from '../../shared/map/LiveMap.jsx'
import { approxNear, distanceKm, fetchRoute, fmtKm, fmtMin, googleMapsLink, hasPoint, resolvePlace } from '../../shared/map/geo.js'
import { useRider } from '../RiderContext.jsx'
import SlideButton from '../components/SlideButton.jsx'

const rs = (n) => `₹${Math.round(n)}`
const ARRIVED_KM = 0.08

function TurnIcon({ modifier }) {
  if (modifier?.includes('right')) return <CornerUpRight size={26} />
  if (modifier?.includes('left')) return <CornerUpLeft size={26} />
  return <ArrowUp size={26} />
}

export default function Task({ onDone }) {
  const { pos, simulating, startSim, stopSim } = useRider()
  const [task, setTask] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [store, setStore] = useState(null)   // resolved {lat,lng,...}
  const [drop, setDrop] = useState(null)
  const [route, setRoute] = useState(null)
  const [checked, setChecked] = useState({})
  const [arrivedAtCustomer, setArrived] = useState(false)
  const [code, setCode] = useState(['', '', '', ''])
  const [cash, setCash] = useState(false)
  const [done, setDone] = useState(null)
  const codeRefs = useRef([])
  const routeFrom = useRef(null)

  const load = useCallback(async () => {
    try {
      const t = await api.get('/api/delivery/tasks/current')
      if (!t || t.cancelled) { setDone({ cancelled: Boolean(t?.cancelled) }); return }
      setTask(t)
    } catch (e) { setError(e.message) }
  }, [])

  // poll: store marking "packed" while rider waits
  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  // resolve map points once
  useEffect(() => {
    if (!task) return
    resolvePlace(task.store)
      .then((s) => { if (s) setStore(s); return resolvePlace(task.address, s) })
      .then((p) => p && setDrop(p))
  }, [task?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const stage = !task ? 'loading'
    : task.status === 'out_for_delivery' ? (arrivedAtCustomer ? 'handover' : 'to_customer')
    : task.partner?.reached_store_at ? 'at_store' : 'to_store'

  const target = stage === 'to_customer' || stage === 'handover' ? drop : store

  // road route from the rider (or the store, if we don't know where the rider is) to the target
  useEffect(() => {
    if (!hasPoint(target)) return
    // no GPS yet (permission blocked / laptop): start from the store, or ~2 km away when going to the store
    const from = hasPoint(pos) ? pos : (stage === 'to_customer' ? store : approxNear(store, 'rider-start'))
    if (!hasPoint(from)) { setRoute(null); return }
    const moved = routeFrom.current && distanceKm(routeFrom.current.p, from) > 0.15
    const changed = !routeFrom.current || routeFrom.current.target !== target
    if (!moved && !changed && route) return
    routeFrom.current = { p: from, target }
    const ctl = new AbortController()
    fetchRoute(from, target, ctl.signal).then(setRoute).catch(() => {})
    return () => ctl.abort()
  }, [pos, target, stage, store]) // eslint-disable-line react-hooks/exhaustive-deps

  const leftKm = hasPoint(pos) && hasPoint(target) ? distanceKm(pos, target) : route?.km
  const near = leftKm !== undefined && leftKm !== null && leftKm < ARRIVED_KM

  const act = async (fn) => {
    setBusy(true); setError('')
    try { await fn() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const reachedStore = () => act(async () => { stopSim(); setTask(await api.post('/api/delivery/tasks/current/reached-store')) })
  const pickedUp = () => act(async () => { setTask(await api.post('/api/delivery/tasks/current/picked-up')); setRoute(null); routeFrom.current = null })
  const deliver = () => act(async () => {
    const r = await api.post('/api/delivery/tasks/current/deliver', { code: code.join(''), cash_collected: cash })
    stopSim()
    setDone({ earning: r.earning })
  })

  // Demo drive: if the laptop GPS is far away (another city), start ~2 km before the target instead
  const startDemo = async () => {
    let coords = route?.coords
    if (route && route.km > 25 && hasPoint(target)) {
      const r = await fetchRoute(approxNear(target, `demo-${stage}`), target).catch(() => null)
      if (r?.coords) coords = r.coords
    }
    startSim(coords)
  }

  const setDigit = (i, v) => {
    const d = v.replace(/\D/g, '').slice(-1)
    setCode((c) => { const n = [...c]; n[i] = d; return n })
    setError('')
    if (d && i < 3) codeRefs.current[i + 1]?.focus()
  }

  const places = useMemo(() => [
    ...(hasPoint(store) ? [{ id: 'store', kind: 'store', ...store }] : []),
    ...(hasPoint(drop) ? [{ id: 'drop', kind: 'home', ...drop }] : []),
  ], [store, drop])

  // ── finished ──
  if (done) {
    return (
      <div className="rd-done">
        <span className={`rd-done-ic ${done.cancelled ? 'red' : ''}`}>{done.cancelled ? '!' : <Check size={40} />}</span>
        <h1>{done.cancelled ? 'Order was cancelled' : 'Delivered!'}</h1>
        <p>{done.cancelled ? 'The customer or store cancelled this order. No need to continue.' : `You earned ${rs(done.earning)} for this delivery.`}</p>
        <button className="rd-btn" onClick={onDone}>Back to deliveries</button>
      </div>
    )
  }
  if (!task) return <div className="rd-center">{error || 'Loading delivery…'}</div>

  const toCustomer = stage === 'to_customer' || stage === 'handover'
  const dest = toCustomer ? { name: task.customer_name, text: task.address.text, phone: task.customer_phone, point: drop }
    : { name: task.store.name, text: task.store.text, phone: task.store.phone, point: store }

  return (
    <div className="rd-home">
      <div className="rd-map">
        <LiveMap
          zoomPosition="topright"
          rider={pos}
          places={places}
          route={route?.coords}
          routeColor={toCustomer ? '#00a870' : '#2563eb'}
          fitKey={`${stage}-${hasPoint(store)}-${hasPoint(drop)}-${Boolean(route)}`}
        />
      </div>

      {(stage === 'to_store' || stage === 'to_customer') && (
        <div className={`rd-banner ${toCustomer ? 'green' : 'blue'}`}>
          <span className="rd-banner-ic">{route?.next ? <TurnIcon modifier={route.next.modifier} /> : <Navigation size={24} />}</span>
          <div className="rd-banner-tx">
            <b>{near ? "You've arrived" : route?.next ? fmtKm(route.next.inKm) : leftKm !== undefined && leftKm !== null ? fmtKm(leftKm) : 'Locating…'}</b>
            <span>{near ? dest.name : route?.next?.text || `Head to ${dest.name}`}</span>
          </div>
          {Number.isFinite(pos?.speed) && <span className="rd-speed"><b>{Math.round(pos.speed)}</b>km/h</span>}
        </div>
      )}

      {(stage === 'to_store' || stage === 'to_customer') && route?.coords && (
        <button className={`rd-demo ${simulating ? 'on' : ''}`} onClick={() => (simulating ? stopSim() : startDemo())}>
          {simulating ? 'Stop demo drive' : 'Demo drive'}
        </button>
      )}

      <section className="rd-sheet">
        <span className="rd-grip" />
        <div className="rd-steps" aria-label="Delivery progress">
          {['to_store', 'at_store', 'to_customer', 'handover'].map((s, i, arr) => (
            <span key={s} className={arr.indexOf(stage) >= i ? 'on' : ''} />
          ))}
        </div>

        <div className="rd-dest">
          <div>
            <span className={`rd-kicker ${toCustomer ? 'green' : 'blue'}`}>
              {stage === 'to_store' ? 'Going to store' : stage === 'at_store' ? 'Pick up at store' : stage === 'to_customer' ? 'Delivering to' : 'Hand over'}
            </span>
            <b>{dest.name}</b>
            <span>{dest.text}</span>
          </div>
          {(stage === 'to_store' || stage === 'to_customer') && route && (
            <div className="rd-eta"><b>{fmtMin(route.min * Math.min(1, (leftKm ?? route.km) / Math.max(route.km, 0.01)))}</b><span>{fmtKm(leftKm ?? route.km)}</span></div>
          )}
        </div>

        {toCustomer && drop?.approx && <p className="rd-note">Exact address not found on the map. The pin is approximate: call the customer or use Google Maps.</p>}
        {toCustomer && task.instructions?.length > 0 && <p className="rd-note">Note: {task.instructions.join(' · ')}</p>}

        {error && <p className="rd-error">{error}</p>}

        {/* ── going to the store ── */}
        {stage === 'to_store' && (
          <>
            <p className={`rd-state ${task.status === 'packed' ? 'ok' : ''}`}>
              <span />{task.status === 'packed' ? 'Order is packed and ready at the counter' : 'Store is packing the order'}
            </p>
            <div className="rd-actions">
              {dest.phone && <a className="rd-icon-btn" href={`tel:+91${dest.phone}`} aria-label="Call store"><Phone size={20} /></a>}
              <a className="rd-icon-btn" href={googleMapsLink(dest.point, dest.text)} target="_blank" rel="noreferrer" aria-label="Open in Google Maps"><Navigation size={20} /></a>
              <button className="rd-btn grow" disabled={busy} onClick={reachedStore}>I've reached the store</button>
            </div>
          </>
        )}

        {/* ── at the store: check items, pick up ── */}
        {stage === 'at_store' && (
          <>
            <div className="rd-items">
              <div className="rd-items-head"><b>#{task.order_number}</b><span className={task.status === 'packed' ? 'ok' : 'wait'}>{task.status === 'packed' ? 'Packed ✓' : 'Packing…'}</span></div>
              {task.items.map((it) => (
                <label key={it.pid}>
                  <input type="checkbox" checked={Boolean(checked[it.pid])} onChange={() => setChecked((c) => ({ ...c, [it.pid]: !c[it.pid] }))} />
                  {it.name} <small>{it.unit} × {it.quantity}</small>
                </label>
              ))}
            </div>
            <SlideButton
              label={task.status === 'packed' ? 'Slide: Picked up order' : 'Waiting for store to pack…'}
              disabled={task.status !== 'packed'}
              busy={busy}
              onConfirm={pickedUp}
            />
          </>
        )}

        {/* ── riding to the customer ── */}
        {stage === 'to_customer' && (
          <>
            {task.cod_amount > 0 && <p className="rd-cod">Collect <b>{rs(task.cod_amount)}</b> cash</p>}
            <div className="rd-actions">
              {dest.phone && <a className="rd-icon-btn" href={`tel:+91${dest.phone}`} aria-label="Call customer"><Phone size={20} /></a>}
              <a className="rd-icon-btn" href={googleMapsLink(dest.point, dest.text)} target="_blank" rel="noreferrer" aria-label="Open in Google Maps"><Navigation size={20} /></a>
              <button className="rd-btn grow" onClick={() => { stopSim(); setArrived(true) }}>I've arrived</button>
            </div>
          </>
        )}

        {/* ── at the door: code + cash ── */}
        {stage === 'handover' && (
          <>
            {task.cod_amount > 0 && (
              <label className="rd-cash">
                <input type="checkbox" checked={cash} onChange={(e) => setCash(e.target.checked)} />
                I collected <b>{rs(task.cod_amount)}</b> cash
              </label>
            )}
            <div>
              <p className="rd-label">Ask the customer for their 4-digit delivery code</p>
              <div className="rd-code">
                {code.map((d, i) => (
                  <input
                    key={i} ref={(el) => { codeRefs.current[i] = el }} inputMode="numeric" maxLength={1}
                    aria-label={`Code digit ${i + 1}`} value={d}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i) codeRefs.current[i - 1]?.focus() }}
                  />
                ))}
              </div>
            </div>
            <SlideButton
              label="Slide: Delivered"
              disabled={code.join('').length < 4 || (task.cod_amount > 0 && !cash)}
              busy={busy}
              onConfirm={deliver}
            />
            <button className="rd-link" onClick={() => setArrived(false)}>Back to map</button>
          </>
        )}
      </section>
    </div>
  )
}
