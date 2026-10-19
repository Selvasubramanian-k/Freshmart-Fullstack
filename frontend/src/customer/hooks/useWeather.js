// Free weather API: Open-Meteo (API key venaam)  https://open-meteo.com
// Location: browser permission kuduthaa antha location, illaina DEFAULT_COORDS.
import { useEffect, useState } from 'react'

// Location permission illana inga irukkura coordinates use aagum -> unga area ku mathikonga
const DEFAULT_COORDS = { lat: 13.0827, lon: 80.2707 }
const CACHE_KEY = 'freshmart_weather'
const CACHE_MS  = 30 * 60 * 1000   // 30 min

function readCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY))
    if (c && Date.now() - c.at < CACHE_MS) return c.data
  } catch { /* ignore */ }
  return null
}
function writeCache(data) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })) } catch { /* ignore */ }
}

function getCoords() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(DEFAULT_COORDS)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(DEFAULT_COORDS),
      { timeout: 4000, maximumAge: 30 * 60 * 1000 }
    )
  })
}

async function fetchWeather({ lat, lon }) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code&timezone=auto`
  const res = await fetch(url)
  if (!res.ok) throw new Error('weather request failed')
  const json = await res.json()
  return { temp: json.current.temperature_2m, code: json.current.weather_code }
}

export default function useWeather() {
  const [weather, setWeather] = useState(() => readCache())

  useEffect(() => {
    if (weather) return
    let cancelled = false
    getCoords()
      .then(fetchWeather)
      .then((w) => { if (!cancelled) { setWeather(w); writeCache(w) } })
      .catch(() => { /* weather fail aanaalum time based recommendation work aagum */ })
    return () => { cancelled = true }
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  return weather
}
