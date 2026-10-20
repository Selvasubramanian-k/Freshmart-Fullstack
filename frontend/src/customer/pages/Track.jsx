import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Phone, ShieldCheck, Store, Bike, PackageCheck, Home as HomeIcon } from 'lucide-react'
import { api } from '../../shared/api/client.js'
import LiveMap from '../../shared/map/LiveMap.jsx'
import { distanceKm, fetchRoute, fmtKm, fmtMin, hasPoint, resolvePlace } from '../../shared/map/geo.js'

// ─────────────────────────────────────────────────────────────
//  Live order tracking (design G): customer watches the rider's
//  scooter drive to them. Polls /api/customer/orders/:id/track every 4s.
// ─────────────────────────────────────────────────────────────
const POLL_MS = 4000
// desktop: the status card floats over the left of the map, keep pins out from under it
const WIDE = typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches
const VEHICLE = { bike: 'Bike', scooter: 'Scooter', cycle: 'Cycle' }
const rs = (n) => `₹${Number(n || 0).toFixed(0)}`

function headline(t, etaMin) {
  if (!t) return { title: 'Loading your order…', sub: '' }
  const name = t.partner?.name?.split(' ')[0]
  switch (t.status) {
    case 'placed': return { title: 'Waiting for the store', sub: `${t.store?.name || 'The store'} will accept your order shortly` }
    case 'confirmed':
    case 'packed':
      if (!t.partner) return { title: t.status === 'packed' ? 'Packed! Finding a rider' : 'Store is packing your order', sub: 'We are assigning a delivery partner near the store' }
      return { title: `${name} is heading to the store`, sub: t.status === 'packed' ? 'Your order is packed and waiting' : 'The store is packing your order' }
    case 'out_for_delivery':
      return { title: etaMin != null ? `Arriving in ${fmtMin(etaMin)}` : 'On the way to you', sub: `${name} picked up your order` }
    case 'delivered': return { title: 'Delivered', sub: 'Enjoy your groceries!' }
    case 'cancelled': return { title: 'Order cancelled', sub: 'This order will not be delivered' }
    default: return { title: t.status.replaceAll('_', ' '), sub: '' }
  }
}

const STEPS = [
  { id: 'placed', label: 'Placed', Icon: PackageCheck },
  { id: 'packed', label: 'Packed', Icon: Store },
  { id: 'out_for_delivery', label: 'On the way', Icon: Bike },
  { id: 'delivered', label: 'Delivered', Icon: HomeIcon },
]
const stepIndex = (s) => ({ placed: 0, confirmed: 0, packed: 1, out_for_delivery: 2, delivered: 3 }[s] ?? -1)

export default function Track() {
  const { orderId } = useParams()
  const [t, setT] = useState(null)
  const [error, setError] = useState('')
  const [store, setStore] = useState(null)
  const [drop, setDrop] = useState(null)
  const [route, setRoute] = useState(null)
  const routeFrom = useRef(null)

  const load = useCallback(() => api.get(`/api/customer/orders/${orderId}/track`)
    .then((d) => { setT(d); setError('') })
    .catch((e) => setError(e.message)), [orderId])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    const onShow = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', onShow)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', load)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [load])

  useEffect(() => {
    if (!t) return
    resolvePlace(t.store)
      .then((s) => { if (s) setStore(s); return resolvePlace(t.drop, s) })
      .then((p) => p && setDrop(p))
  }, [t?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const rider = hasPoint(t?.rider_location) ? t.rider_location : null
  const live = t && ['confirmed', 'packed', 'out_for_delivery'].includes(t.status)
  const toYou = t?.status === 'out_for_delivery'
  const target = toYou ? drop : store

  // road route: rider -> store (before pickup) or rider -> you (after pickup)
  useEffect(() => {
    if (!live) return
    const from = rider || (toYou ? store : null)
    if (!hasPoint(from) || !hasPoint(target)) return
    const prev = routeFrom.current
    if (prev && prev.target === target && distanceKm(prev.p, from) < 0.15) return
    routeFrom.current = { p: from, target }
    const ctl = new AbortController()
    fetchRoute(from, target, ctl.signal).then(setRoute).catch(() => {})
    return () => ctl.abort()
  }, [rider?.lat, rider?.lng, target, live, toYou, store]) // eslint-disable-line react-hooks/exhaustive-deps

  const leftKm = rider && hasPoint(drop) ? distanceKm(rider, drop) : null
  const etaMin = toYou && route ? route.min * Math.min(1, (leftKm ?? route.km) / Math.max(route.km, 0.01)) : null
  const head = headline(t, etaMin)

  const places = useMemo(() => [
    ...(hasPoint(store) ? [{ id: 'store', kind: 'store', ...store, label: store.name }] : []),
    ...(hasPoint(drop) ? [{ id: 'home', kind: 'home', ...drop, label: drop.approx ? 'You (approx)' : 'You' }] : []),
  ], [store, drop])

  if (error && !t) {
    return (
      <div className="tk-page tk-msg">
        <p>{error}</p>
        <Link className="tk-back-link" to="/account">Back to my orders</Link>
      </div>
    )
  }

  const idx = stepIndex(t?.status)
  const p = t?.partner

  return (
    <div className="tk-page">
      <div className="tk-map">
        <LiveMap
          rider={live ? rider : null}
          riderLabel={p?.name?.split(' ')[0]}
          places={places}
          route={live ? route?.coords : null}
          routeColor={toYou ? '#00a870' : '#2563eb'}
          fitPadding={WIDE ? { paddingTopLeft: [480, 70], paddingBottomRight: [70, 70] } : undefined}
          fitKey={`${t?.status}-${places.length}-${Boolean(rider)}-${Boolean(route)}`}
        />
        <Link to="/account" className="tk-back" aria-label="Back to my orders"><ArrowLeft size={20} /></Link>
      </div>

      <section className="tk-sheet" aria-live="polite">
        <div className="tk-head">
          <div>
            <h1>{head.title}</h1>
            <p>{head.sub}</p>
          </div>
          {toYou && leftKm != null && <span className="tk-dist">{fmtKm(leftKm)}<small>away</small></span>}
        </div>

        {idx >= 0 && (
          <ol className="tk-steps">
            {STEPS.map(({ id, label, Icon }, i) => (
              <li key={id} className={i < idx ? 'done' : i === idx ? 'now' : ''}>
                <span><Icon size={16} /></span>{label}
              </li>
            ))}
          </ol>
        )}

        {p && t.status !== 'delivered' && t.status !== 'cancelled' && (
          <div className="tk-partner">
            <span className="tk-avatar">{p.name.charAt(0)}</span>
            <div>
              <b>{p.name}</b>
              <small>{VEHICLE[p.vehicle?.type] || 'Rider'}{p.vehicle?.number ? ` · ${p.vehicle.number}` : ''}</small>
            </div>
            {p.phone && <a className="tk-call" href={`tel:+91${p.phone}`} aria-label={`Call ${p.name}`}><Phone size={18} /></a>}
          </div>
        )}

        {p && live && !rider && (
          <p className="tk-wait">{p.name.split(' ')[0]}'s live location will show here once they start riding.</p>
        )}

        {t?.delivery_code && live && (
          <div className="tk-code">
            <ShieldCheck size={22} />
            <div><small>Share this code with the rider at your door</small><b>{t.delivery_code.split('').join(' ')}</b></div>
          </div>
        )}

        {t && (
          <div className="tk-bill">
            <span>#{t.order_number} · {t.payment.method === 'cod' ? `Pay ${rs(t.bill.total)} cash on delivery` : `Paid ${rs(t.bill.total)} online`}</span>
            <Link to="/account">Order details</Link>
          </div>
        )}
      </section>
    </div>
  )
}
