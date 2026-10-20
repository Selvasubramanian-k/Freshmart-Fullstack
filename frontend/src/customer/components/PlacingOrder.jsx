// "Placing your order…" overlay (design D): delivery scooter on a moving road.
// Checkout la slide-to-pay pannadhum backend reply varra varaikkum varum. Styles: customer.css -> "PLACING ORDER".
export default function PlacingOrder({ cod = false }) {
  return (
    <div className="po-overlay" role="alertdialog" aria-modal="true" aria-live="assertive" aria-label="Placing your order">
      <div className="po-card">
        <div className="po-scene" aria-hidden="true">
          <div className="po-trees">
            {[0, 1].map((k) => (
              <svg key={k} width="480" height="70" viewBox="0 0 480 70">
                <g fill="#bfe6d3"><circle cx="40" cy="40" r="24" /><circle cx="170" cy="46" r="18" /><circle cx="300" cy="36" r="27" /><circle cx="420" cy="44" r="20" /></g>
              </svg>
            ))}
          </div>
          <div className="po-road"><div className="po-lines">{Array.from({ length: 14 }, (_, i) => <span key={i} />)}</div></div>

          <div className="po-scooter">
            <span className="po-puff" />
            <svg width="160" height="88" viewBox="0 0 240 130">
              <rect x="20" y="20" width="76" height="62" rx="10" fill="#00a870" />
              <path d="M44 38h28l-3 22H47z" fill="#fff" />
              <path d="M51 38v-4a7 7 0 0 1 14 0v4" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              <path d="M96 84h70l20-34h22" fill="none" stroke="#0b3d2e" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M30 84h110c10 0 18 8 18 18H30z" fill="#007a50" />
              <circle cx="136" cy="30" r="14" fill="#f2c9a0" />
              <path d="M122 26a14 14 0 0 1 28 0z" fill="#007a50" />
              <path d="M128 44h20l14 36h-34z" fill="#00a870" />
            </svg>
            <svg className="po-wheel w1" width="30" height="30" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="#1a1d23" /><circle cx="22" cy="22" r="8" fill="#cfd8dc" /><path d="M22 6v32M6 22h32" stroke="#555" strokeWidth="2" /></svg>
            <svg className="po-wheel w2" width="30" height="30" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="#1a1d23" /><circle cx="22" cy="22" r="8" fill="#cfd8dc" /><path d="M22 6v32M6 22h32" stroke="#555" strokeWidth="2" /></svg>
          </div>
        </div>
        <h2>Placing your order…</h2>
        <p>{cod ? 'Confirming with the store' : 'Confirming your payment'}. Please don't close this page.</p>
      </div>
    </div>
  )
}
