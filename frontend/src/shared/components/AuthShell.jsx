import { useState } from 'react'

// Login page layout (design D2): left = 3 role strips (Shop / Sell / Deliver),
// hover / tap a strip to open it. Each strip has the FreshMart wave background
// with its own silhouettes. Right = white form card.
// Text / colours maathanum na ROLES list la mattum maathunga.

const ICONS = {
  leaf: <path fillRule="evenodd" d="M12 88 C8 40 40 8 90 10 C92 58 62 92 12 88 Z M18 82 L68 32 L71 35 L21 85 Z" />,
  apple: <><path d="M50 30 C38 18 12 24 12 54 C12 80 30 96 42 92 C46 90 54 90 58 92 C70 96 88 80 88 54 C88 24 62 18 50 30 Z" /><path d="M50 30 C48 20 52 10 62 4 C64 14 60 24 50 30 Z" /></>,
  carrot: <><path d="M30 40 C40 30 58 34 64 46 L92 86 C96 94 86 100 80 94 L26 54 C22 48 24 44 30 40 Z" /><path d="M34 38 C24 28 24 14 34 6 C40 18 40 28 38 36 Z" /><path d="M46 34 C46 20 54 10 64 8 C64 20 58 30 52 36 Z" /></>,
  tomato: <><path d="M50 24 C78 22 94 44 90 64 C86 86 66 96 50 96 C34 96 14 86 10 64 C6 44 22 22 50 24 Z" /><path d="M50 26 L42 8 L52 16 L60 6 L60 22 L76 16 L62 30 Z" /></>,
  broc: <><circle cx="34" cy="40" r="22" /><circle cx="64" cy="36" r="24" /><circle cx="50" cy="56" r="22" /><path d="M42 70 L58 70 L62 96 L38 96 Z" /></>,
  shop: <><path d="M10 38 L20 12 L80 12 L90 38 Z" /><path d="M16 42 L84 42 L84 92 L60 92 L60 64 L40 64 L40 92 L16 92 Z" /></>,
  basket: <><path d="M8 40 L92 40 L82 90 L18 90 Z" /><path d="M28 40 L44 10 L50 13 L36 40 Z" /><path d="M72 40 L56 10 L50 13 L64 40 Z" /></>,
  tag: <path fillRule="evenodd" d="M50 8 L92 8 L92 50 L46 96 L4 54 Z M72 22 A7 7 0 1 0 72.1 22 Z" />,
  box: <><path d="M50 6 L92 28 L50 50 L8 28 Z" /><path d="M8 34 L46 56 L46 96 L8 74 Z" /><path d="M92 34 L54 56 L54 96 L92 74 Z" /></>,
  chart: <><path d="M10 90 L10 60 L28 60 L28 90 Z" /><path d="M40 90 L40 40 L58 40 L58 90 Z" /><path d="M70 90 L70 14 L88 14 L88 90 Z" /></>,
  scooter: <><path fillRule="evenodd" d="M22 54 A18 18 0 1 0 22.1 54 Z M22 64 A8 8 0 1 1 21.9 64 Z" /><path fillRule="evenodd" d="M80 54 A18 18 0 1 0 80.1 54 Z M80 64 A8 8 0 1 1 79.9 64 Z" /><path d="M30 70 L60 70 L72 40 L84 40 L84 32 L66 32 L54 62 L36 62 Z" /><path d="M10 28 L40 28 L40 52 L10 52 Z" /></>,
  pin: <path fillRule="evenodd" d="M50 4 C28 4 14 20 14 40 C14 66 50 96 50 96 C50 96 86 66 86 40 C86 20 72 4 50 4 Z M50 26 A14 14 0 1 0 50.1 26 Z" />,
  parcel: <><path d="M10 22 L90 22 L90 88 L10 88 Z" /><path d="M42 8 L58 8 L58 22 L42 22 Z" /></>,
  clock: <path fillRule="evenodd" d="M50 6 A44 44 0 1 0 50.1 6 Z M46 22 L54 22 L54 50 L72 62 L68 69 L46 55 Z" />,
  road: <path d="M6 94 C30 60 20 40 50 30 C80 20 70 8 94 6 L94 18 C78 20 88 34 54 42 C30 48 40 70 20 94 Z" />,
}

// [icon, x, y, size, rotate, layer]  layer 'd' = dark silhouette, 'l' = light silhouette
const SPOTS = [[250, 20, 100, 40, 'd'], [90, 420, 120, -35, 'd'], [250, 520, 90, -10, 'd'], [520, 180, 90, 0, 'd'],
  [40, 50, 110, -25, 'l'], [470, 40, 120, 12, 'l'], [470, 330, 120, 20, 'l'], [30, 600, 110, 0, 'l'], [20, 280, 100, 0, 'l'], [400, 600, 100, 15, 'd']]

const ROLES = [
  { id: 'customer', word: 'Shop', kicker: 'Customers', tone: 'shop',
    headline: 'Your kitchen, always stocked', sub: 'Fruits, vegetables, dairy and daily essentials, delivered to your door.',
    bg: { base: '#007a50', wave: '#00a870', waveOp: 0.4, top: '#0b3d2e', dark: ['#0b3d2e', 0.2], light: ['#ffffff', 0.12] },
    icons: ['leaf', 'carrot', 'apple', 'tomato', 'leaf', 'apple', 'carrot', 'tomato', 'broc', 'broc'] },
  { id: 'admin', word: 'Sell', kicker: 'Store owners', tone: 'sell',
    headline: 'Your store, open to the city', sub: 'Accept orders, manage stock and see your daily earnings in one dashboard.',
    bg: { base: '#f5a623', wave: '#ffd27a', waveOp: 0.55, top: '#b86e00', dark: ['#7a4a00', 0.18], light: ['#ffffff', 0.25] },
    icons: ['shop', 'basket', 'tag', 'chart', 'box', 'tag', 'basket', 'shop', 'chart', 'box'] },
  { id: 'delivery', word: 'Deliver', kicker: 'Delivery partners', tone: 'ride',
    headline: 'Ride more, earn more', sub: 'Go online, pick up nearby orders, follow the map and get paid for every drop.',
    bg: { base: '#0b3d2e', wave: '#00a870', waveOp: 0.3, top: '#000000', dark: ['#00a870', 0.25], light: ['#ffffff', 0.08] },
    icons: ['pin', 'scooter', 'clock', 'parcel', 'road', 'scooter', 'pin', 'parcel', 'road', 'pin'] },
]

function RoleBg({ role }) {
  const { bg, icons } = role
  return (
    <svg className="auth-strip-bg" viewBox="0 0 640 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="640" height="760" fill={bg.base} />
      <path d="M-40 520 C120 430 260 520 380 600 C520 700 700 640 780 760 L-40 760 Z" fill={bg.wave} opacity={bg.waveOp} />
      <path d="M0 0 L640 0 C580 90 430 120 330 76 C220 28 100 44 0 126 Z" fill={bg.top} opacity="0.35" />
      <path d="M380 370 C460 320 570 350 610 436 C650 520 566 584 470 562 C386 542 316 432 380 370 Z" fill={bg.wave} opacity="0.3" />
      {SPOTS.map(([x, y, w, rot, layer], i) => {
        const [fill, op] = layer === 'd' ? bg.dark : bg.light
        return (
          <svg key={i} x={x} y={y} width={w} height={w} viewBox="0 0 100 100" overflow="visible">
            <g fill={fill} opacity={op} transform={`rotate(${rot} 50 50)`}>{ICONS[icons[i]]}</g>
          </svg>
        )
      })}
    </svg>
  )
}

// green = green tile (white page), default = white tile (dark / green backgrounds, eg. admin sidebar)
export function Logo({ size = 44, green = false }) {
  const tile = green ? '#007a50' : '#ffffff'
  const mark = green ? '#ffffff' : '#007a50'
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill={tile} />
      <path d="M13 16h14l-2 13H15L13 16z" fill={mark} />
      <path d="M17 16v-3a3 3 0 0 1 6 0v3" stroke={mark} strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export default function AuthShell({ children, wide = false }) {
  const [open, setOpen] = useState(0)

  return (
    <div className="login-root">
      {/* LEFT: Shop / Sell / Deliver strips */}
      <div className="auth-strips" role="tablist" aria-label="FreshMart is for">
        {ROLES.map((r, i) => {
          const on = open === i
          return (
            <button
              key={r.id} type="button" role="tab" aria-selected={on}
              className={`auth-strip ${r.tone} ${on ? 'on' : ''}`}
              onMouseEnter={() => setOpen(i)} onFocus={() => setOpen(i)} onClick={() => setOpen(i)}
            >
              <RoleBg role={r} />
              <span className="auth-strip-kicker">{r.kicker}</span>
              {on ? (
                <span className="auth-strip-text">
                  <span className="auth-strip-title">{r.headline}</span>
                  <span className="auth-strip-sub">{r.sub}</span>
                </span>
              ) : (
                <span className="auth-strip-word">{r.word}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* RIGHT: form */}
      <div className="login-right">
        <svg className="login-wave login-wave-side" viewBox="0 0 90 760" preserveAspectRatio="none" aria-hidden="true">
          <path d="M90 0 L90 760 L45 760 C5 640 85 500 35 380 C-5 280 65 140 45 0 Z" fill="#ffffff" />
        </svg>
        <svg className="login-wave login-wave-top" viewBox="0 0 390 56" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 56 L0 30 C60 -6 130 10 200 30 C270 50 330 40 390 8 L390 56 Z" fill="#ffffff" />
        </svg>
        <div className={`login-card ${wide ? 'login-card-wide' : ''}`}>
          <div className="auth-brand"><Logo green /><span>FreshMart</span></div>
          {children}
        </div>
      </div>
    </div>
  )
}
