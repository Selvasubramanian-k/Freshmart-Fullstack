// Rider state shared by all delivery pages: online status + live location.
// Location comes from the phone GPS (navigator.geolocation). For testing on a laptop
// there is a "demo drive" that moves the rider along the route instead.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../shared/api/client.js'
import { bearing, distanceKm } from '../shared/map/geo.js'

const RiderContext = createContext(null)
const POST_EVERY_MS = 4000
const SIM_TICK_MS = 1000
const SIM_STEP_KM = 0.06 // ~60 m per second in the demo (fast, so a trip takes ~1 min)

// point that is `km` along a polyline of [lat, lng]
function pointAlong(coords, km) {
  let left = km
  for (let i = 0; i < coords.length - 1; i++) {
    const a = { lat: coords[i][0], lng: coords[i][1] }
    const b = { lat: coords[i + 1][0], lng: coords[i + 1][1] }
    const seg = distanceKm(a, b)
    if (left <= seg) {
      const k = seg ? left / seg : 0
      return { lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k, heading: bearing(a, b), done: false }
    }
    left -= seg
  }
  const last = coords[coords.length - 1]
  return { lat: last[0], lng: last[1], heading: null, done: true }
}

export function RiderProvider({ children }) {
  const [me, setMe] = useState(null)              // {is_online, active_order_id, vehicle, location}
  const [pos, setPos] = useState(null)            // {lat, lng, heading, speed}
  const [gpsError, setGpsError] = useState('')
  const [simulating, setSimulating] = useState(false)
  // once "Demo drive" is used, laptop GPS stays off (else the rider jumps back to the laptop's spot)
  const [demoMode, setDemoMode] = useState(false)
  const lastPost = useRef(0)
  const simRef = useRef(null)

  const refreshMe = useCallback(async () => {
    const m = await api.get('/api/delivery/me')
    setMe(m)
    if (m.location && !pos) setPos(m.location)
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { refreshMe().catch(() => {}) }, [refreshMe])

  const push = useCallback((p, force = false) => {
    setPos(p)
    const now = Date.now()
    if (!force && now - lastPost.current < POST_EVERY_MS) return
    lastPost.current = now
    api.post('/api/delivery/location', {
      lat: p.lat, lng: p.lng,
      heading: Number.isFinite(p.heading) ? Math.round(p.heading) % 360 : null,
      speed: Number.isFinite(p.speed) ? Math.min(200, Math.round(p.speed)) : null,
    }).catch(() => {})
  }, [])

  // real GPS while online (and not in demo drive)
  useEffect(() => {
    if (!me?.is_online || simulating || demoMode) return
    if (!('geolocation' in navigator)) { setGpsError('This device has no GPS'); return }
    const id = navigator.geolocation.watchPosition(
      (g) => {
        setGpsError('')
        push({
          lat: g.coords.latitude, lng: g.coords.longitude,
          heading: Number.isFinite(g.coords.heading) ? g.coords.heading : null,
          speed: Number.isFinite(g.coords.speed) ? g.coords.speed * 3.6 : null,
        })
      },
      (err) => setGpsError(err.code === 1 ? 'Location permission denied. Allow location for this site.' : 'Cannot get your location right now.'),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [me?.is_online, simulating, demoMode, push])

  // demo drive along a route
  const stopSim = useCallback(() => {
    clearInterval(simRef.current)
    simRef.current = null
    setSimulating(false)
  }, [])

  const startSim = useCallback((coords) => {
    if (!coords || coords.length < 2) return
    clearInterval(simRef.current)
    setSimulating(true)
    setDemoMode(true)
    let total = 0
    for (let i = 0; i < coords.length - 1; i++) total += distanceKm({ lat: coords[i][0], lng: coords[i][1] }, { lat: coords[i + 1][0], lng: coords[i + 1][1] })
    const stepKm = Math.max(SIM_STEP_KM, total / 50)   // any trip finishes in ~50 s
    let km = 0
    push({ lat: coords[0][0], lng: coords[0][1], heading: null, speed: 0 }, true)
    simRef.current = setInterval(() => {
      km += stepKm
      const p = pointAlong(coords, km)
      push({ lat: p.lat, lng: p.lng, heading: p.heading, speed: 32 }, true)
      if (p.done) stopSim()
    }, SIM_TICK_MS)
  }, [push, stopSim])

  useEffect(() => () => clearInterval(simRef.current), [])

  const setOnline = useCallback(async (on) => {
    const r = await api.patch('/api/delivery/online', { is_online: on })
    setMe((m) => ({ ...m, is_online: r.is_online }))
    if (!on) { stopSim(); setDemoMode(false) }   // go offline -> back to real GPS next time
  }, [stopSim])

  const value = { me, setMe, refreshMe, setOnline, pos, setPos: push, gpsError, simulating, startSim, stopSim }
  return <RiderContext.Provider value={value}>{children}</RiderContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRider() {
  const ctx = useContext(RiderContext)
  if (!ctx) throw new Error('useRider must be used inside <RiderProvider>')
  return ctx
}
