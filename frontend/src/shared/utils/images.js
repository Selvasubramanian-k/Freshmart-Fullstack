// Product image_url -> real <img src>
//   "asset:apple.jpg"   -> bundled image from src/assets (seeded products)
//   "/uploads/x.jpg"    -> image uploaded by the store admin (served by backend)
//   "https://..."       -> external link
import { API_BASE } from '../api/client.js'

const ASSETS = import.meta.glob('../../assets/**/*.{jpg,jpeg,png,svg,webp}', { eager: true, import: 'default' })

// Every big jpg/png in src/assets has a small .webp copy (max 600px, ~30 KB).
// Use the .webp when it exists, else the original file.
const webpOf = (path) => path.replace(/\.(jpe?g|png)$/i, '.webp')

export function resolveImage(url) {
  if (!url) return null
  if (url.startsWith('asset:')) {
    const path = `../../assets/${url.slice(6)}`
    return ASSETS[webpOf(path)] || ASSETS[path] || null
  }
  if (url.startsWith('/')) return `${API_BASE}${url}`
  return url
}
