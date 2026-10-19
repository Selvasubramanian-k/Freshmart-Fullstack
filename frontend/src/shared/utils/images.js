// Product image_url -> real <img src>
//   "asset:apple.jpg"   -> bundled image from src/assets (seeded products)
//   "/uploads/x.jpg"    -> image uploaded by the store admin (served by backend)
//   "https://..."       -> external link
import { API_BASE } from '../api/client.js'

const ASSETS = import.meta.glob('../../assets/**/*.{jpg,jpeg,png,svg,webp}', { eager: true, import: 'default' })

export function resolveImage(url) {
  if (!url) return null
  if (url.startsWith('asset:')) return ASSETS[`../../assets/${url.slice(6)}`] || null
  if (url.startsWith('/')) return `${API_BASE}${url}`
  return url
}
