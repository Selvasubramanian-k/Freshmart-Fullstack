import ProductCard from './ProductCard.jsx'

// items = [{ product, reason }]
export default function Recommendations({ title, subtitle, items, cart, addToCart, increment, decrement }) {
  if (!items || items.length === 0) return null
  return (
    <section className="reco-section">
      <div className="reco-head">
        <h2 className="reco-title">{title}</h2>
        {subtitle && <p className="reco-sub">{subtitle}</p>}
      </div>
      <div className="reco-row">
        {items.map(({ product, reason }) => (
          <div className="reco-item" key={product.id}>
            <ProductCard
              product={product}
              reason={reason}
              qty={cart[product.id] || 0}
              onAdd={addToCart}
              onInc={increment}
              onDec={decrement}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
