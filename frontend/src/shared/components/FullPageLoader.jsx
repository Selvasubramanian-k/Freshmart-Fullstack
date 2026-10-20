// Full-page loader (design A): bouncing produce + rotating tips.
// App open aagumbodhu, login check, page code load aagumbodhu varum.
// Styles: shared.css -> "PRODUCE LOADER".
import { useEffect, useState } from 'react'

const TIPS = [
  'Tip: use FRESH20 for ₹20 off your order',
  'Delivery in 10 minutes from a store near you',
  'Not fresh? Return it from your orders',
  'Pay with GPay and get 10% off',
]

function Apple() {
  return (
    <svg width="56" height="56" viewBox="0 0 60 60">
      <path d="M30 16c-8-8-24-4-24 14 0 16 12 26 19 24 2-1 8-1 10 0 7 2 19-8 19-24 0-18-16-22-24-14z" fill="#e85d4a" />
      <path d="M30 16c-1-6 2-11 8-13 0 6-3 10-8 13z" fill="#007a50" />
    </svg>
  )
}
function Carrot() {
  return (
    <svg width="56" height="56" viewBox="0 0 60 60">
      <path d="M20 22c6-6 16-4 20 4l14 24c3 5-3 9-7 6L18 32c-4-3-3-7 2-10z" fill="#f5a623" />
      <path d="M22 20c-6-6-6-14 0-18 4 6 4 12 2 18zM28 18c0-8 5-14 12-14 0 8-4 13-10 16z" fill="#00a870" />
    </svg>
  )
}
function Tomato() {
  return (
    <svg width="56" height="56" viewBox="0 0 60 60">
      <circle cx="30" cy="34" r="22" fill="#d9483b" />
      <path d="M30 14l-6-8 7 4 6-8v10l9-4-8 9z" fill="#007a50" />
    </svg>
  )
}
function Broccoli() {
  return (
    <svg width="56" height="56" viewBox="0 0 60 60">
      <circle cx="20" cy="22" r="12" fill="#00a870" /><circle cx="38" cy="20" r="13" fill="#00a870" /><circle cx="30" cy="32" r="12" fill="#007a50" />
      <path d="M24 40h12l2 16H22z" fill="#7cc79f" />
    </svg>
  )
}

const ITEMS = [Apple, Carrot, Tomato, Broccoli]

export default function FullPageLoader({ label = 'Picking the freshest for you…' }) {
  const [tip, setTip] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 3000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="fm-produce" role="status" aria-live="polite">
      <div className="fm-produce-row" aria-hidden="true">
        {ITEMS.map((Item, i) => (
          <div className="fm-produce-item" key={i} style={{ '--d': `${i * 0.15}s` }}>
            <div className="fm-produce-bounce"><Item /></div>
            <span className="fm-produce-shadow" />
          </div>
        ))}
      </div>
      <p className="fm-produce-title">{label}</p>
      <p className="fm-produce-tip" key={tip}>{TIPS[tip]}</p>
    </div>
  )
}
