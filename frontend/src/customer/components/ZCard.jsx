import ProductImage from './ProductImage.jsx'

// Compact Zepto-style card: image mela ADD button, green price badge, "₹xx OFF"
export default function ZCard({ product: p, qty, onAdd, onInc, onDec }) {
  const off = p.oldPrice && p.oldPrice > p.price ? Math.round(p.oldPrice - p.price) : 0
  const soldOut = p.stock === 0
  const atMax   = qty >= p.stock
  return (
    <div className={`zc ${soldOut ? 'is-soldout' : ''}`}>
      <div className="zc-img">
        <ProductImage product={p} />
        {soldOut ? (
          <span className="zc-add zc-soldout">SOLD OUT</span>
        ) : qty === 0 ? (
          <button type="button" className="zc-add" onClick={() => onAdd(p)}>ADD</button>
        ) : (
          <div className="zc-step">
            <button type="button" aria-label={`Remove one ${p.name}`} onClick={() => onDec(p.id)}>−</button>
            <span>{qty}</span>
            <button type="button" aria-label={`Add one ${p.name}`} disabled={atMax} onClick={() => onInc(p.id)}>+</button>
          </div>
        )}
      </div>
      <div className="zc-prices">
        <span className="zc-price">₹{Number(p.price).toFixed(0)}</span>
        {off > 0 && <span className="zc-old">₹{Number(p.oldPrice).toFixed(0)}</span>}
      </div>
      {off > 0 && <div className="zc-off">₹{off} OFF</div>}
      <div className="zc-name" title={p.name}>{p.name}</div>
      <div className="zc-unit">{p.unit}{!soldOut && p.stock <= 5 && <span className="stock-low"> · Only {p.stock} left</span>}</div>
    </div>
  )
}
