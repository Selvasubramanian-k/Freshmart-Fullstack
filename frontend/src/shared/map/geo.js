// Map helpers: distance, heading, free geocoding (OpenStreetMap Nominatim) and free routing (OSRM).
// No API keys needed. If a service is unreachable we fall back to a straight line + estimate.

const R = 6371 // km

export const toRad = (d) => (d * Math.PI) / 180
export const hasPoint = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng)

export function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// compass bearing 0..360 (0 = north)
export function bearing(a, b) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat))
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng))
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

export const fmtKm = (km) => (km < 1 ? `${Math.max(50, Math.round(km * 1000 / 50) * 50)} m` : `${km.toFixed(1)} km`)
export const fmtMin = (min) => `${Math.max(1, Math.round(min))} min`

// ── Geocoding: address text -> {lat, lng} (cached in this browser) ──
const GEO_KEY = 'freshmart_geocode'
const readGeo = () => { try { return JSON.parse(localStorage.getItem(GEO_KEY)) || {} } catch { return {} } }

async function nominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  const [hit] = await res.json()
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null
}

// Typed Indian addresses ("No. 7, Lake View Road, Velachery, Chennai 600042") often don't match
// as a whole, so try smaller versions: without door no. -> area + city -> pincode -> city.
function candidates(text) {
  const parts = text.split(',').map((s) => s.trim()).filter(Boolean)
  const pin = text.match(/\b\d{6}\b/)?.[0]
  const noDoor = parts.filter((p) => !/^(no\.?\s*)?[\d/-]+[a-z]?$/i.test(p) && !/^(flat|door|plot|no)\b/i.test(p))
  const list = [text, noDoor.join(', '), noDoor.slice(-3).join(', '), pin && `${pin}, India`, noDoor.slice(-2).join(', '), noDoor.slice(-1)[0]]
  return [...new Set(list.filter((s) => s && s.length > 3))]
}

export async function geocode(text) {
  if (!text) return null
  const cache = readGeo()
  if (cache[text]) return cache[text]
  for (const q of candidates(text)) {
    try {
      const p = await nominatim(q)
      if (p) {
        try { localStorage.setItem(GEO_KEY, JSON.stringify({ ...cache, [text]: p })) } catch { /* storage full */ }
        return p
      }
    } catch { return null }   // offline / blocked
  }
  return null
}

// Last resort when an address can't be found on the map: a fixed point ~2.5 km from the store,
// same for rider and customer (based on the address text), marked approx.
export function approxNear(store, text = '') {
  if (!hasPoint(store)) return null
  let h = 0
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const ang = toRad(h % 360)
  const km = 2 + (h % 10) / 10
  return {
    lat: store.lat + (km / 111) * Math.cos(ang),
    lng: store.lng + (km / (111 * Math.cos(toRad(store.lat)))) * Math.sin(ang),
    approx: true,
  }
}

// ── Routing: road route between two points ──
const TURN = { left: 'Turn left', right: 'Turn right', 'slight left': 'Keep left', 'slight right': 'Keep right',
  'sharp left': 'Sharp left', 'sharp right': 'Sharp right', straight: 'Go straight', uturn: 'Make a U-turn' }

function describe(step) {
  const m = step.maneuver || {}
  const road = step.name ? ` on ${step.name}` : ''
  if (m.type === 'arrive') return 'Arrive at destination'
  if (m.type === 'roundabout' || m.type === 'rotary') return `Take exit ${m.exit || 1} at the roundabout`
  if (m.modifier && TURN[m.modifier]) return `${TURN[m.modifier]}${road}`
  return `Continue${road}`
}

export async function fetchRoute(from, to, signal) {
  const straight = () => {
    const km = distanceKm(from, to) * 1.3
    return { coords: [[from.lat, from.lng], [to.lat, to.lng]], km, min: (km / 18) * 60 + 1, next: null, approx: true }
  }
  if (!hasPoint(from) || !hasPoint(to)) return null
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`
    const res = await fetch(url, { signal })
    const data = await res.json()
    const r = data.routes?.[0]
    if (!r) return straight()
    const steps = r.legs?.[0]?.steps || []
    const nextStep = steps[1] || steps[0]
    return {
      coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      km: r.distance / 1000,
      // OSRM car speeds are optimistic for city two-wheelers in traffic: pad a little
      min: (r.duration / 60) * 1.25 + 1,
      next: nextStep ? { text: describe(nextStep), inKm: (steps[0]?.distance || 0) / 1000, modifier: nextStep.maneuver?.modifier } : null,
      approx: false,
    }
  } catch (e) {
    if (e.name === 'AbortError') throw e
    return straight()
  }
}

// Open turn-by-turn navigation in the Google Maps app / site (free, no key)
export function googleMapsLink(point, text) {
  const dest = hasPoint(point) ? `${point.lat},${point.lng}` : encodeURIComponent(text || '')
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=two-wheeler`
}

// Resolve a {text, lat, lng} place: use its coords, else geocode the text,
// else (if `near` is given) an approximate point near it.
export async function resolvePlace(place, near) {
  if (!place) return null
  if (hasPoint(place)) return place
  const p = (await geocode(place.text)) || (near ? approxNear(near, place.text) : null)
  return p ? { ...place, ...p } : null
}
