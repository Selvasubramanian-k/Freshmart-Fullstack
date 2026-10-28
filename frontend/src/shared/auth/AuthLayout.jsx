import { Link } from 'react-router-dom'

// ─────────────────────────────────────────────────────────────
//  Login / sign-up layout (ellaa role kum ore URL).
//  Phone: `front` step la full-screen front page, matha steps la form mattum.
//  Laptop: left = FreshMart brand panel (eppovum), right = step content.
// ─────────────────────────────────────────────────────────────

export function Logo({ light = false }) {
  return (
    <div className={`au-logo ${light ? 'light' : ''}`}>
      <span className="au-logo-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      </span>
      <span className="au-logo-text"><b>Fresh<em>Mart</em></b><small>YOUR DAILY FRESH STORE</small></span>
    </div>
  )
}

// Fresh basket drawing (CSS shapes) – real photo venumna inga maathalam
export function Basket() {
  return (
    <div className="au-basket" role="img" aria-label="A basket of fresh vegetables, fruits, milk and bread">
      <span className="b-sun" />
      <span className="b-milk" /><span className="b-cap" />
      <span className="b-bread" />
      <span className="b-leaf l1" /><span className="b-leaf l2" />
      <span className="b-tomato" /><span className="b-tleaf" />
      <span className="b-orange" /><span className="b-lemon" /><span className="b-lime" />
      <span className="b-body" /><span className="b-rim" />
      <span className="b-tag t1"><b>10</b>MINUTES</span>
      <span className="b-tag t2">Farm fresh every morning</span>
    </div>
  )
}

/**
 * front    : true -> phone shows the full front page (children hidden), laptop shows children on the right
 * onStart  : "Get started" on the phone front page
 * footer   : small line under the phone front page button (eg. join link)
 */
export default function AuthLayout({ front = false, onStart, footer, children }) {
  return (
    <div className={`au ${front ? 'is-front' : ''}`}>
      <aside className="au-brand">
        <span className="au-blob" aria-hidden="true" />
        <Logo />
        <Basket />
        <div className="au-hello">
          <span className="au-tamil" lang="ta">வணக்கம்!</span>
          <h1>Fresh groceries from your FreshMart, in 10 minutes.</h1>
          <p>Vegetables, fruits, milk and daily needs. Same price as the shop.</p>
        </div>
        <div className="au-front-cta">
          <div className="au-perks"><span>10-min delivery</span><span>UPI / Cash</span><span>Easy returns</span></div>
          <button type="button" className="au-btn" onClick={onStart}>
            Get started
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </button>
          {footer}
        </div>
      </aside>
      <main className="au-main">
        <div className="au-card">{children}</div>
      </main>
    </div>
  )
}

export function BackLink({ onClick, to, children = 'Back' }) {
  const icon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
  return to
    ? <Link className="au-back" to={to}>{icon}{children}</Link>
    : <button type="button" className="au-back" onClick={onClick}>{icon}{children}</button>
}
