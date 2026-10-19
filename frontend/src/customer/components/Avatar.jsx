import { useEffect, useState } from 'react'

// Profile picture.
//  1) user.picture / photo / avatar (Google photo) irundha adhu
//  2) illaina user select panna Male / Female illustration (Account page + menu la maathalam)
//  3) onnum select pannalaina neutral avatar
const PALETTES = [
  { bg: '#d4f3e5', skin: '#f2c9a0', hair: '#2b2118', shirt: '#00a870' },
  { bg: '#fde9c8', skin: '#d99b6c', hair: '#1a1411', shirt: '#f5a623' },
  { bg: '#dbe8fb', skin: '#e8b88a', hair: '#4a2f1b', shirt: '#4285f4' },
  { bg: '#fbd9e3', skin: '#c88a5e', hair: '#161010', shirt: '#d6457a' },
  { bg: '#e6dcf7', skin: '#f0c19a', hair: '#7a4a21', shirt: '#7a3fc4' },
]
const EVENT = 'freshmart-avatar'
const userKey = (u) => `freshmart_avatar:${(u?.email || u?.phone || u?.name || 'guest').toLowerCase()}`

export function readAvatarKind(user) {
  try { const v = localStorage.getItem(userKey(user)); return v === 'male' || v === 'female' ? v : '' } catch { return '' }
}
export function saveAvatarKind(user, kind) {
  try { localStorage.setItem(userKey(user), kind) } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT))
}

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

export default function Avatar({ user, size = 40, className = '', kind: forced }) {
  const [saved, setSaved] = useState(() => readAvatarKind(user))
  useEffect(() => {
    const sync = () => setSaved(readAvatarKind(user))
    sync()
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [user])

  const kind = forced || saved
  const src = !forced && (user?.picture || user?.photo || user?.avatar)
  const style = { width: size, height: size, borderRadius: '50%', display: 'block', flexShrink: 0 }
  if (src) return <img className={className} src={src} alt="" style={{ ...style, objectFit: 'cover' }} referrerPolicy="no-referrer" />

  const seed = (user?.name || user?.email || user?.phone || '').trim()
  const p = PALETTES[forced === 'female' ? 3 : forced === 'male' ? 2 : seed ? hash(seed) % PALETTES.length : 0]
  const female = kind === 'female'
  const male = kind === 'male'
  return (
    <svg className={className} style={style} viewBox="0 0 64 64" role="img" aria-label={user?.name || 'Guest'}>
      <rect width="64" height="64" fill={p.bg} />
      <path d="M10 64c2-14 11-20 22-20s20 6 22 20z" fill={p.shirt} />
      <rect x="28" y="36" width="8" height="9" rx="3" fill={p.skin} />
      {female && <path d="M16 31c0-13 7-19 16-19s16 6 16 19v16c0 2-2 3-4 3H20c-2 0-4-1-4-3z" fill={p.hair} />}
      <circle cx="32" cy="29" r="12" fill={p.skin} />
      {female ? (
        <>
          <path d="M20 29c0-10 5-15 12-15s12 5 12 15c-3-6-7-8-12-8s-9 2-12 8z" fill={p.hair} />
          <circle cx="32" cy="22.500" r="1.100" fill="#d6204a" />
          <circle cx="20" cy="34" r="1.500" fill="#f5a623" />
          <circle cx="44" cy="34" r="1.500" fill="#f5a623" />
        </>
      ) : (
        <path d="M20 28c-1-9 5-15 12-15s13 6 12 15c-2-4-5-7-8-7-4 2-12 2-16 7z" fill={p.hair} />
      )}
      <circle cx="27.500" cy="30" r="1.400" fill="#2b2118" />
      <circle cx="36.500" cy="30" r="1.400" fill="#2b2118" />
      {male && <path d="M27 35.500c1.500-1.200 3-1.500 5-1.500s3.500.3 5 1.500" stroke={p.hair} strokeWidth="1.800" strokeLinecap="round" fill="none" />}
      <path d="M28.500 37c2 1.500 5 1.500 7 0" stroke="#8a4b2d" strokeWidth="1.400" strokeLinecap="round" fill="none" />
    </svg>
  )
}

// Male / Female select panra chinna control
export function AvatarPicker({ user, compact = false, onPick }) {
  const [kind, setKind] = useState(() => readAvatarKind(user))
  useEffect(() => {
    const sync = () => setKind(readAvatarKind(user))
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [user])
  const pick = (k) => { setKind(k); saveAvatarKind(user, k); onPick?.(k) }
  return (
    <div className={`av-picker ${compact ? 'compact' : ''}`} role="group" aria-label="Choose avatar">
      {['male', 'female'].map((k) => (
        <button key={k} type="button" className={kind === k ? 'on' : ''} aria-pressed={kind === k} onClick={() => pick(k)}>
          <Avatar user={user} size={compact ? 30 : 38} kind={k} />
          <span>{k === 'male' ? 'Male' : 'Female'}</span>
        </button>
      ))}
    </div>
  )
}
