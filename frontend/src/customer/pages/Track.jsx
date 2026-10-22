import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronUp, Phone, RefreshCw, ShieldCheck, Wallet, X } from 'lucide-react'
import { api } from '../../shared/api/client.js'
import LiveMap from '../../shared/map/LiveMap.jsx'
import DeliveredScreen from '../components/DeliveredScreen.jsx'
import { curvePoints, distanceKm, fetchRoute, fmtKm, hasPoint, resolvePlace } from '../../shared/map/geo.js'

// ─────────────────────────────────────────────────────────────
//  Order tracking. Order pottavudane indha page varum.
//    Phone  (design A): full-screen map + pull-up sheet (tap to open rider / code / order info)
//    Laptop (design B): white side panel on the left, map on the right (nothing on top of the map)
//  Polls /api/customer/orders/:id/track every 4s.
// ─────────────────────────────────────────────────────────────
const POLL_MS = 4000
const WIDE_QUERY = '(min-width: 900px)'
const VEHICLE = { bike: 'Bike', scooter: 'Scooter', cycle: 'Cycle' }
const rs = (n) => `₹${Number(n || 0).toFixed(0)}`
const toDate = (iso) => new Date(/Z$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`)
const hhmm = (iso) => (iso ? toDate(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '')
// "Order delivered!" screen only for a fresh delivery (old delivered orders just show the map)
const FRESH_MS = 15 * 60 * 1000
const isFresh = (iso) => Boolean(iso) && Date.now() - toDate(iso) < FRESH_MS

// minutes the store still needs before the order can leave
const PREP_MIN = { placed: 10, confirmed: 7, packed: 2 }
const STAGE = { placed: 0, confirmed: 1, packed: 2, out_for_delivery: 3, delivered: 4 }

function statusCard(t) {
  const store = t.store?.name || 'the store'
  const rider = t.partner?.name?.split(' ')[0]
  switch (t.status) {
    case 'placed': return { kicker: 'ORDER PLACED', title: 'Order received!', sub: `Waiting for ${store} to accept your order` }
    case 'confirmed': return { kicker: 'ACCEPTED', title: 'Packing your order', sub: rider ? `${store} is packing it. ${rider} will pick it up` : `${store} accepted it and is picking your items` }
    case 'packed': return { kicker: 'PACKED', title: rider ? `${rider} is at the store` : 'Packed and ready', sub: rider ? 'Your order is packed and will be picked up now' : 'Finding the nearest delivery partner' }
    case 'out_for_delivery': return { kicker: 'ON THE WAY', title: 'On the way', sub: rider ? `${rider} picked up your order and is riding to you` : 'The store\u2019s staff is bringing your order' }
    case 'delivered': return { kicker: 'DELIVERED', title: 'Delivered', sub: `Delivered at ${hhmm(t.delivered_at)}. Enjoy your groceries!` }
    case 'cancelled': return { kicker: 'CANCELLED', title: 'Order cancelled', sub: t.status_history?.at(-1)?.note || 'This order will not be delivered' }
    default: return { kicker: t.status.replaceAll('_', ' ').toUpperCase(), title: 'Order update', sub: '' }
  }
}

function useWide() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(WIDE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

export default function Track() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const wide = useWide()
  const [t, setT] = useState(null)
  const [error, setError] = useState('')
  const [store, setStore] = useState(null)
  const [drop, setDrop] = useState(null)
  const [route, setRoute] = useState(null)
  const [open, setOpen] = useState(false)       // phone sheet expanded
  const [spin, setSpin] = useState(false)
  const [closed, setClosed] = useState(false)
  const [sheetH, setSheetH] = useState(240)
  const routeFrom = useRef(null)
  const sheetRef = useRef(null)
  const goHome = useCallback(() => { setClosed(true); navigate('/') }, [navigate])

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

  // phone: keep the map buttons just above the sheet, whatever its height
  useEffect(() => {
    const el = sheetRef.current
    if (!el || wide) return
    const ro = new ResizeObserver(() => setSheetH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [wide, t?.id])

  const rider = hasPoint(t?.rider_location) ? t.rider_location : null
  const live = t && ['placed', 'confirmed', 'packed', 'out_for_delivery'].includes(t.status)
  const toYou = t?.status === 'out_for_delivery'
  const riderToStore = !toYou && Boolean(t?.partner) && Boolean(rider)

  // route on the map: rider -> you (on the way), rider -> store (going to pick up), else store -> you
  const from = toYou ? (rider || store) : riderToStore ? rider : store
  const target = riderToStore ? store : drop
  useEffect(() => {
    if (!live || !hasPoint(from) || !hasPoint(target)) return
    const prev = routeFrom.current
    if (prev && prev.target === target && distanceKm(prev.p, from) < 0.15) return
    routeFrom.current = { p: from, target }
    const ctl = new AbortController()
    fetchRoute(from, target, ctl.signal).then(setRoute).catch(() => {})
    return () => ctl.abort()
  }, [from?.lat, from?.lng, target, live]) // eslint-disable-line react-hooks/exhaustive-deps

  // ETA in minutes: store prep time + ride time (rough until the rider is on the way)
  const leftKm = toYou && hasPoint(rider) && hasPoint(drop) ? distanceKm(rider, drop) : null
  const rideMin = (a, b) => (hasPoint(a) && hasPoint(b) ? (distanceKm(a, b) * 1.3 / 18) * 60 + 1 : 12)
  let eta = null
  if (toYou) eta = route ? route.min * Math.min(1, (leftKm ?? route.km) / Math.max(route.km, 0.01)) : rideMin(rider || store, drop)
  else if (live) eta = (PREP_MIN[t.status] ?? 5) + rideMin(store, drop)
  const etaText = eta == null ? null : Math.max(1, Math.round(eta))

  // until the rider is riding, show a curved dotted line store -> you
  const dotted = live && !toYou && !riderToStore
  const curve = useMemo(() => (dotted ? curvePoints(store, drop) : null), [dotted, store, drop])

  const places = useMemo(() => [
    ...(hasPoint(store) ? [{ id: 'store', kind: 'store', ...store, label: store.name }] : []),
    ...(hasPoint(drop) ? [{ id: 'home', kind: 'home', ...drop, label: drop.approx ? 'Home (approx)' : 'Home' }] : []),
  ], [store, drop])

  const refresh = () => { setSpin(true); load().finally(() => setTimeout(() => setSpin(false), 500)) }

  if (error && !t) {
    return (
      <div className="tr-page tr-msg">
        <p>{error}</p>
        <button type="button" className="tr-link" onClick={() => navigate('/account')}>Back to my orders</button>
      </div>
    )
  }

  if (t?.status === 'delivered' && !closed && isFresh(t.delivered_at)) {
    return <DeliveredScreen order={t} onDone={goHome} />
  }

  const card = t ? statusCard(t) : { kicker: '', title: 'Loading your order…', sub: '' }
  const stage = STAGE[t?.status] ?? -1
  const p = t?.partner
  const cod = t?.payment?.method === 'cod'
  const showDetails = wide || open

  const titleBlock = (
    <div className="tr-title">
      <b>{t?.store?.name || 'Your order'}</b>
      {t && <span>{wide ? `#${t.order_number} · ` : ''}{hhmm(t.created_at)} · {t.items_count} item{t.items_count === 1 ? '' : 's'}</span>}
    </div>
  )
  const backBtn = <button type="button" className="tr-round" onClick={() => navigate('/account')} aria-label="Back to my orders"><ArrowLeft size={20} /></button>
  const refreshBtn = <button type="button" className={`tr-round ${spin ? 'spin' : ''}`} onClick={refresh} aria-label="Refresh status"><RefreshCw size={19} /></button>

  return (
    <div className={`tr-page ${wide ? 'wide' : 'phone'}${!wide && open ? ' sheet-open' : ''}`} style={{ '--sheet-h': `${sheetH}px` }}>
      {/* ── map ── */}
      <div className="tr-map">
        <LiveMap
          rider={live && p ? rider : null}
          riderLabel={p?.name?.split(' ')[0]}
          places={places}
          route={dotted ? curve : live ? route?.coords : null}
          routeStyle={dotted ? 'dotted' : 'road'}
          routeColor={toYou ? '#00a870' : '#0b3d2e'}
          fitPadding={wide ? { padding: [70, 70] } : { paddingTopLeft: [40, 110], paddingBottomRight: [60, sheetH + 30] }}
          fitKey={`${t?.status}-${places.length}-${Boolean(rider)}-${Boolean(dotted ? curve : route)}-${wide}`}
        />
        {!wide && <div className="tr-top">{backBtn}{titleBlock}{refreshBtn}</div>}
      </div>

      {/* ── side panel (laptop) / pull-up sheet (phone) ── */}
      <aside ref={sheetRef} className={`tr-side ${open ? 'open' : ''}`} aria-live="polite">
        {!wide && (
          <button type="button" className="tr-grip" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? 'Show less' : 'Show rider, code and order info'}>
            <span />
          </button>
        )}
        {wide && <div className="tr-side-top">{backBtn}{titleBlock}{refreshBtn}</div>}

        <section className={`tr-status ${t?.status === 'cancelled' ? 'bad' : ''}`}>
          <div className="tr-head">
            <div>
              {card.kicker && (
                <span className="tr-kicker">
                  {t?.status === 'cancelled' ? <X size={14} strokeWidth={3} /> : <Check size={14} strokeWidth={3.2} />}{card.kicker}
                </span>
              )}
              <h1>{card.title}</h1>
              <p>{card.sub}</p>
            </div>
            {etaText && <div className="tr-eta"><b>{etaText}</b><span>mins</span></div>}
          </div>
          {stage >= 0 && (
            <div className="tr-bars" aria-label={`Step ${Math.min(stage, 3) + 1} of 4`}>
              {[0, 1, 2, 3].map((i) => <span key={i} className={i <= Math.min(stage, 3) ? 'on' : ''} />)}
            </div>
          )}
        </section>

        {showDetails && (
          <div className="tr-details">
            {p && live && (
              <div className="tr-rider">
                <span className="tr-av">{p.name.charAt(0)}</span>
                <div>
                  <b>{p.name}</b>
                  <small>{VEHICLE[p.vehicle?.type] || 'Rider'}{p.vehicle?.number ? ` · ${p.vehicle.number}` : ''}{leftKm != null ? ` · ${fmtKm(leftKm)} away` : ''}</small>
                </div>
                {p.phone && <a href={`tel:+91${p.phone}`} aria-label={`Call ${p.name}`}><Phone size={18} /></a>}
              </div>
            )}
            {p && live && !rider && <p className="tr-note">{p.name.split(' ')[0]}'s live location will show on the map once they start riding.</p>}
            {!p && live && stage >= 1 && (
              <p className="tr-note">{toYou ? 'The store\u2019s own staff is delivering this order, so live location isn\u2019t available.' : 'Assigning a delivery partner near the store…'}</p>
            )}

            {t?.delivery_code && live && stage >= 1 && (
              <div className="tr-code"><ShieldCheck size={20} /><span>Share this code at your door</span><b>{t.delivery_code.split('').join(' ')}</b></div>
            )}
            {cod && live && (
              <div className="tr-cash"><Wallet size={20} /><span>Keep <b>{rs(t.bill.total)}</b> ready. Pay cash to the rider at your door.</span></div>
            )}

            {t && (
              <div className="tr-info">
                <b className="tr-info-h">Order info</b>
                <div className="tr-route">
                  <div className="tr-route-line" aria-hidden="true"><span className="s" /><i /><span className="h" /></div>
                  <div className="tr-route-text">
                    <div><b>{t.store?.name}</b><span>{t.store?.text}</span></div>
                    <div><b>{t.drop?.label || 'Home'}</b><span>{t.drop?.text}</span></div>
                  </div>
                </div>
                {t.instructions?.length > 0 && <div className="tr-chips">{t.instructions.map((x) => <span key={x}>{x}</span>)}</div>}
                <div className="tr-items">
                  {t.items?.map((it, i) => <div key={i}>{it.name} <small>{it.unit} × {it.quantity}</small></div>)}
                  <div className="tr-total"><span>#{t.order_number}</span><b>{rs(t.bill?.total)} · {cod ? 'Cash' : 'Paid online'}</b></div>
                </div>
              </div>
            )}
          </div>
        )}

        {!wide && (
          <button type="button" className="tr-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'Show less' : p && live ? 'Rider, code & order info' : 'Order info & instructions'}
            <ChevronUp size={18} className={open ? 'open' : ''} />
          </button>
        )}
      </aside>
    </div>
  )
}
