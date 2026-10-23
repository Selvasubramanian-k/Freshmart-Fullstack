// Live map (Leaflet + free OpenStreetMap/CARTO tiles).
//   rider  : {lat, lng, heading?}  -> top-view scooter rider that glides + turns as it moves
//   places : [{id, kind: 'store'|'home', lat, lng, label}]
//   route  : [[lat, lng], ...] road line to draw
// Used by the rider app (navigation) and the customer track page.
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { bearing, distanceKm, hasPoint } from './geo.js'
import './map.css'

// Top view scooter rider, facing EAST (we rotate it by heading - 90)
const RIDER_SVG = `
<svg width="64" height="64" viewBox="-32 -32 64 64" aria-hidden="true">
  <g transform="scale(1.15)">
    <ellipse cx="2" cy="2" rx="26" ry="14" fill="#000" opacity=".16"/>
    <rect x="-27" y="-3" width="9" height="6" rx="3" fill="#1a1d23"/>
    <rect x="24" y="-3" width="9" height="6" rx="3" fill="#1a1d23"/>
    <rect x="-10" y="-6" width="34" height="12" rx="6" fill="#3d4a50"/>
    <rect x="18" y="-14" width="4" height="28" rx="2" fill="#1a1d23"/>
    <circle cx="26" cy="0" r="2.5" fill="#ffd166"/>
    <rect x="-26" y="-12" width="18" height="24" rx="4" fill="#00a870" stroke="#fff" stroke-width="1.5"/>
    <path d="M-21 -4h8l-1 8h-6z" fill="#fff"/>
    <path d="M-19 -4v-2a2 2 0 0 1 4 0v2" fill="none" stroke="#fff" stroke-width="1.2"/>
    <path d="M2 -8 L19 -13" stroke="#f2b48c" stroke-width="4" stroke-linecap="round"/>
    <path d="M2 8 L19 13" stroke="#f2b48c" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="0" cy="0" rx="8" ry="11" fill="#007a50"/>
    <circle cx="5" cy="0" r="7.5" fill="#fff" stroke="#0b3d2e" stroke-width="1"/>
    <path d="M-2 0 H12" stroke="#00a870" stroke-width="2.5"/>
    <path d="M9 -5 A7 7 0 0 1 9 5" stroke="#1a1d23" stroke-width="3" fill="none" stroke-linecap="round"/>
  </g>
</svg>`

const STORE_SVG = `<svg width="40" height="50" viewBox="0 0 40 50" aria-hidden="true"><path d="M20 0a20 20 0 0 1 20 20c0 15-20 30-20 30S0 35 0 20A20 20 0 0 1 20 0z" fill="#0b3d2e"/><path d="M12 15h16l-2 11H14z" fill="#fff"/><path d="M16 15v-3a4 4 0 0 1 8 0v3" fill="none" stroke="#fff" stroke-width="2"/></svg>`
const HOME_SVG = `<svg width="40" height="50" viewBox="0 0 40 50" aria-hidden="true"><path d="M20 0a20 20 0 0 1 20 20c0 15-20 30-20 30S0 35 0 20A20 20 0 0 1 20 0z" fill="#e85d4a"/><path d="M11 22 20 13l9 9v9H11z" fill="#fff"/></svg>`

const pinIcon = (kind, label) => L.divIcon({
  className: 'lm-pin',
  html: `<div class="lm-pin-in ${kind}">${kind === 'home' ? HOME_SVG : STORE_SVG}${label ? `<span class="lm-pin-label">${label}</span>` : ''}</div>`,
  iconSize: [40, 50],
  iconAnchor: [20, 50],
})

const riderIcon = (label) => L.divIcon({
  className: 'lm-rider',
  html: `<div class="lm-rider-pulse"></div><div class="lm-rider-rot">${RIDER_SVG}</div>${label ? `<span class="lm-rider-label">${label}</span>` : ''}`,
  iconSize: [64, 64],
  iconAnchor: [32, 32],
})

// routeStyle: 'road' = solid road route, 'dotted' = curved dotted line (before the rider is on the way)
export default function LiveMap({ rider, riderLabel, places = [], route, routeColor = '#00a870', routeStyle = 'road', fitKey, fitPadding, zoomPosition = 'bottomright', className = '' }) {
  const boxRef = useRef(null)
  const mapRef = useRef(null)
  const layersRef = useRef({ places: null, route: null, routeHalo: null, rider: null })
  const riderPos = useRef(null)
  const refitRef = useRef(null)
  const riderHeading = useRef(90)
  const animRef = useRef(0)
  const fittedRef = useRef(null)

  // create the map once
  useEffect(() => {
    const map = L.map(boxRef.current, { zoomControl: false, attributionControl: true })
    L.control.zoom({ position: zoomPosition, zoomInTitle: 'Zoom in', zoomOutTitle: 'Zoom out' }).addTo(map)
    // Free OpenStreetMap tiles (no API key). For heavy production traffic set
    // VITE_MAP_TILE_URL to a tile provider you have an account with.
    L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    map.setView([13.0827, 80.2707], 13) // Chennai until we know better
    layersRef.current.places = L.layerGroup().addTo(map)
    mapRef.current = map
    // keep tiles/markers right when the box changes size (side panel, sheet, rotate)
    let last = '', t
    const ro = new ResizeObserver(([e]) => {
      const size = `${Math.round(e.contentRect.width)}x${Math.round(e.contentRect.height)}`
      if (size === last) return
      const first = !last
      last = size
      map.invalidateSize({ pan: false })
      if (!first) { clearTimeout(t); t = setTimeout(() => refitRef.current?.(), 120) } // box changed: show everything again
    })
    ro.observe(boxRef.current)
    return () => {
      ro.disconnect(); clearTimeout(t)
      cancelAnimationFrame(animRef.current)
      map.remove()
      mapRef.current = null
      // forget layers of the removed map (React StrictMode mounts twice in dev)
      layersRef.current = { places: null, route: null, routeHalo: null, rider: null }
      riderPos.current = null
      fittedRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- map is created once

  // place pins
  const placesKey = JSON.stringify(places.map((p) => [p.id, p.kind, p.lat, p.lng, p.label]))
  useEffect(() => {
    const group = layersRef.current.places
    if (!group) return
    group.clearLayers()
    places.filter(hasPoint).forEach((p) => {
      L.marker([p.lat, p.lng], { icon: pinIcon(p.kind, p.label), keyboard: false, zIndexOffset: 100 }).addTo(group)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesKey])

  // route line
  useEffect(() => {
    const map = mapRef.current
    const L_ = layersRef.current
    if (L_.route) { L_.route.remove(); L_.routeHalo.remove(); L_.route = L_.routeHalo = null }
    if (!map || !route || route.length < 2) return
    if (routeStyle === 'dotted') {
      L_.routeHalo = L.polyline(route, { color: routeColor, weight: 7, opacity: 0.1, lineCap: 'round', interactive: false }).addTo(map)
      L_.route = L.polyline(route, { color: routeColor, weight: 4, opacity: 0.9, lineCap: 'round', dashArray: '1 11', className: 'lm-dots', interactive: false }).addTo(map)
      return
    }
    L_.routeHalo = L.polyline(route, { color: routeColor, weight: 12, opacity: 0.18, lineCap: 'round' }).addTo(map)
    L_.route = L.polyline(route, { color: routeColor, weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(map)
  }, [route, routeColor, routeStyle])

  // rider marker: glide from old to new position and turn towards travel direction
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const L_ = layersRef.current
    if (!hasPoint(rider)) {
      if (L_.rider) { L_.rider.remove(); L_.rider = null; riderPos.current = null }
      return
    }
    if (!L_.rider) {
      L_.rider = L.marker([rider.lat, rider.lng], { icon: riderIcon(riderLabel), zIndexOffset: 1000, keyboard: false }).addTo(map)
      riderPos.current = { lat: rider.lat, lng: rider.lng }
    }
    const from = riderPos.current
    const to = { lat: rider.lat, lng: rider.lng }
    let heading = riderHeading.current
    if (distanceKm(from, to) > 0.003) heading = bearing(from, to)
    else if (Number.isFinite(rider.heading)) heading = rider.heading
    riderHeading.current = heading
    const rot = L_.rider.getElement()?.querySelector('.lm-rider-rot')
    if (rot) rot.style.transform = `rotate(${heading - 90}deg)`

    cancelAnimationFrame(animRef.current)
    const t0 = performance.now()
    const dur = 1200
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur)
      const lat = from.lat + (to.lat - from.lat) * k
      const lng = from.lng + (to.lng - from.lng) * k
      L_.rider.setLatLng([lat, lng])
      riderPos.current = { lat, lng }
      if (k < 1) animRef.current = requestAnimationFrame(step)
    }
    animRef.current = requestAnimationFrame(step)
    // rider went off screen -> follow
    // keep it out from under floating cards (fitPadding), not just inside the map box
    const pad = fitPadding || { padding: [60, 60] }
    map.panInside([to.lat, to.lng], {
      paddingTopLeft: pad.paddingTopLeft || pad.padding || [60, 60],
      paddingBottomRight: pad.paddingBottomRight || pad.padding || [60, 60],
      animate: true,
    })
  }, [rider, riderLabel]) // eslint-disable-line react-hooks/exhaustive-deps

  // fit everything in view when the set of things to show changes (fitKey)
  useEffect(() => {
    const map = mapRef.current
    if (!map || fittedRef.current === fitKey) return
    const pts = [...places.filter(hasPoint).map((p) => [p.lat, p.lng])]
    if (hasPoint(rider)) pts.push([rider.lat, rider.lng])
    if (route?.length) pts.push(...route)
    if (!pts.length) return
    fittedRef.current = fitKey
    if (pts.length === 1) map.setView(pts[0], 15)
    else map.fitBounds(L.latLngBounds(pts), { ...(fitPadding || { padding: [60, 60] }), maxZoom: 16 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, placesKey, route, rider])

  const recenter = () => {
    const map = mapRef.current
    if (!map) return
    const pts = places.filter(hasPoint).map((p) => [p.lat, p.lng])
    if (hasPoint(rider)) pts.push([rider.lat, rider.lng])
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { ...(fitPadding || { padding: [60, 60] }), maxZoom: 16 })
    else if (pts.length) map.setView(pts[0], 16)
  }
  refitRef.current = recenter

  return (
    <div className={`lm-wrap ${className}`}>
      <div ref={boxRef} className="lm-map" />
      <button type="button" className="lm-recenter" aria-label="Re-center map" onClick={recenter}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
      </button>
    </div>
  )
}
