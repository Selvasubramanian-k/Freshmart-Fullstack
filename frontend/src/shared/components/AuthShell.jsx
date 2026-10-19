// Login + Register pages share this layout (left: green produce panel, right: white form card).
// Tagline maathanum na inga mattum maathunga.
const TAGLINE = 'Your kitchen, always stocked'
const SUBLINE = 'Fruits, vegetables, dairy and daily essentials, delivered to your door.'

// ── Background: green waves + fruit / vegetable silhouettes ──
export function ProduceBg() {
  return (
    <svg className="login-bg" viewBox="0 0 640 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <symbol id="lg-leaf" viewBox="0 0 100 100"><path fillRule="evenodd" d="M12 88 C8 40 40 8 90 10 C92 58 62 92 12 88 Z M18 82 L68 32 L71 35 L21 85 Z" /></symbol>
        <symbol id="lg-apple" viewBox="0 0 100 100"><path d="M50 30 C38 18 12 24 12 54 C12 80 30 96 42 92 C46 90 54 90 58 92 C70 96 88 80 88 54 C88 24 62 18 50 30 Z" /><path d="M50 30 C48 20 52 10 62 4 C64 14 60 24 50 30 Z" /></symbol>
        <symbol id="lg-carrot" viewBox="0 0 100 100"><path d="M30 40 C40 30 58 34 64 46 L92 86 C96 94 86 100 80 94 L26 54 C22 48 24 44 30 40 Z" /><path d="M34 38 C24 28 24 14 34 6 C40 18 40 28 38 36 Z" /><path d="M46 34 C46 20 54 10 64 8 C64 20 58 30 52 36 Z" /></symbol>
        <symbol id="lg-tomato" viewBox="0 0 100 100"><path d="M50 24 C78 22 94 44 90 64 C86 86 66 96 50 96 C34 96 14 86 10 64 C6 44 22 22 50 24 Z" /><path d="M50 26 L42 8 L52 16 L60 6 L60 22 L76 16 L62 30 Z" /></symbol>
        <symbol id="lg-banana" viewBox="0 0 100 100"><path d="M8 22 C2 62 34 96 90 80 C92 76 90 72 86 72 C48 74 28 54 22 22 C20 18 10 18 8 22 Z" /></symbol>
        <symbol id="lg-broc" viewBox="0 0 100 100"><circle cx="34" cy="40" r="22" /><circle cx="64" cy="36" r="24" /><circle cx="50" cy="56" r="22" /><path d="M42 70 L58 70 L62 96 L38 96 Z" /></symbol>
      </defs>

      <rect width="640" height="760" fill="#007a50" />
      <path d="M-40 520 C120 430 260 520 380 600 C520 700 700 640 780 760 L-40 760 Z" fill="#00a870" opacity="0.4" />
      <path d="M0 0 L640 0 C580 90 430 120 330 76 C220 28 100 44 0 126 Z" fill="#0b3d2e" opacity="0.35" />
      <path d="M380 370 C460 320 570 350 610 436 C650 520 566 584 470 562 C386 542 316 432 380 370 Z" fill="#00a870" opacity="0.28" />

      <g fill="#0b3d2e" opacity="0.2">
        <use href="#lg-leaf"   x="250" y="20"  width="100" height="100" transform="rotate(40 300 70)" />
        <use href="#lg-carrot" x="90"  y="420" width="120" height="120" transform="rotate(-35 150 480)" />
        <use href="#lg-apple"  x="250" y="520" width="90"  height="90"  transform="rotate(-10 295 565)" />
        <use href="#lg-broc"   x="560" y="540" width="100" height="100" />
        <use href="#lg-tomato" x="560" y="180" width="90"  height="90" />
      </g>
      <g fill="#ffffff" opacity="0.1">
        <use href="#lg-leaf"   x="40"  y="50"  width="110" height="110" transform="rotate(-25 95 105)" />
        <use href="#lg-apple"  x="500" y="40"  width="120" height="120" transform="rotate(12 560 100)" />
        <use href="#lg-carrot" x="520" y="330" width="120" height="120" transform="rotate(20 580 390)" />
        <use href="#lg-tomato" x="30"  y="560" width="110" height="110" />
        <use href="#lg-banana" x="330" y="600" width="130" height="130" transform="rotate(-15 395 665)" />
        <use href="#lg-broc"   x="20"  y="300" width="100" height="100" />
        <use href="#lg-leaf"   x="440" y="640" width="90"  height="90"  transform="rotate(30 485 685)" />
      </g>
    </svg>
  )
}

export function Logo({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#ffffff" />
      <path d="M13 16h14l-2 13H15L13 16z" fill="#007a50" />
      <path d="M17 16v-3a3 3 0 0 1 6 0v3" stroke="#007a50" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export default function AuthShell({ children, tagline = TAGLINE, subline = SUBLINE, wide = false }) {
  return (
    <div className="login-root">
      {/* LEFT: green waves + produce */}
      <div className="login-left">
        <ProduceBg />
        <div className="login-brand">
          <Logo />
          <span className="login-brand-name">FreshMart</span>
        </div>
        <div className="login-hero">
          <h1 className="login-hero-title">{tagline}</h1>
          <p className="login-hero-sub">{subline}</p>
        </div>
      </div>

      {/* RIGHT: form */}
      <div className="login-right">
        <svg className="login-wave login-wave-side" viewBox="0 0 90 760" preserveAspectRatio="none" aria-hidden="true">
          <path d="M90 0 L90 760 L45 760 C5 640 85 500 35 380 C-5 280 65 140 45 0 Z" fill="#ffffff" />
        </svg>
        <svg className="login-wave login-wave-top" viewBox="0 0 390 56" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 56 L0 30 C60 -6 130 10 200 30 C270 50 330 40 390 8 L390 56 Z" fill="#ffffff" />
        </svg>
        <div className={`login-card ${wide ? 'login-card-wide' : ''}`}>{children}</div>
      </div>
    </div>
  )
}
