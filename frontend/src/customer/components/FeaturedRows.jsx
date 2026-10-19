import { useRef } from 'react'
import { PRODUCTS } from '../data/products.js'
import ZCard from './ZCard.jsx'
import Icon from './Icon.jsx'

// Bestsellers: "popular" tag, every category la irunthum konjam konjam (round-robin)
function pickBestsellers(limit = 10) {
  const byCat = {}
  PRODUCTS.filter((p) => p.tag === 'popular').forEach((p) => { (byCat[p.cat] ||= []).push(p) })
  const lists = Object.values(byCat)
  const out = []
  for (let i = 0; out.length < limit && lists.some((l) => i < l.length); i++) {
    lists.forEach((l) => { if (l[i] && out.length < limit) out.push(l[i]) })
  }
  return out
}

// Deals: athiga discount ulla products mudhalla
function pickDeals(limit = 10) {
  return PRODUCTS
    .filter((p) => p.oldPrice && p.oldPrice > p.price)
    .sort((a, b) => (b.oldPrice - b.price) / b.oldPrice - (a.oldPrice - a.price) / a.oldPrice)
    .slice(0, limit)
}

function Row({ title, icon, items, cart, addToCart, increment, decrement }) {
  const ref = useRef(null)
  if (items.length === 0) return null
  return (
    <section className="zs-section">
      <div className="zs-head">
        <h2 className="zs-title">{icon && <Icon name={icon} />} {title}</h2>
      </div>
      <div className="zs-rowwrap">
        <div className="zs-row" ref={ref}>
          {items.map((p) => (
            <ZCard key={p.id} product={p} qty={cart[p.id] || 0} onAdd={addToCart} onInc={increment} onDec={decrement} />
          ))}
        </div>
        {items.length > 4 && (
          <button type="button" className="zs-arrow" aria-label={`Scroll ${title}`}
            onClick={() => ref.current?.scrollBy({ left: 520, behavior: 'smooth' })}>›</button>
        )}
      </div>
    </section>
  )
}

export default function FeaturedRows(props) {
  return (
    <>
      <Row title="Bestsellers" icon="flame" items={pickBestsellers()} {...props} />
      <Row title="Deals of the Day" icon="tag" items={pickDeals()} {...props} />
    </>
  )
}
