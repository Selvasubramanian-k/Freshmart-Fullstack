import { useRef } from 'react'
import { CATEGORIES } from '../data/categories.js'
import { PRODUCTS } from '../data/products.js'
import ZCard from './ZCard.jsx'
import Icon from './Icon.jsx'

// Oru category = oru heading ("Dairy") + "See All" + side scroll row.
function Row({ cat, onCategory, cart, addToCart, increment, decrement }) {
  const ref = useRef(null)
  const items = PRODUCTS.filter((p) => p.cat === cat.id)
  if (items.length === 0) return null

  const scroll = (dir) => ref.current?.scrollBy({ left: dir * 520, behavior: 'smooth' })

  return (
    <section className="zs-section">
      <div className="zs-head">
        <h2 className="zs-title"><Icon name={cat.icon} /> {cat.title || cat.label}</h2>
        <button type="button" className="zs-seeall" onClick={() => onCategory(cat.id)}>See All ›</button>
      </div>
      <div className="zs-rowwrap">
        <div className="zs-row" ref={ref}>
          {items.map((p) => (
            <ZCard
              key={p.id}
              product={p}
              qty={cart[p.id] || 0}
              onAdd={addToCart}
              onInc={increment}
              onDec={decrement}
            />
          ))}
        </div>
        {items.length > 4 && (
          <button type="button" className="zs-arrow" aria-label={`Scroll ${cat.title || cat.label}`} onClick={() => scroll(1)}>›</button>
        )}
      </div>
    </section>
  )
}

export default function CategorySections(props) {
  return (
    <div className="zs-wrap">
      {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
        <Row key={c.id} cat={c} {...props} />
      ))}
    </div>
  )
}
