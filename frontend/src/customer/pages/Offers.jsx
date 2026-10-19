import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import { OFFERS } from '../data/offers.js'
import { getProduct } from '../data/products.js'
import Icon from '../components/Icon.jsx'

export default function Offers({ cart = {}, addToCart, increment, decrement, onBrowse }) {
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState(null)
  const panelRef = useRef(null)

  const active   = OFFERS.find((o) => o.id === activeId)
  const products = active ? active.productIds.map(getProduct).filter(Boolean) : []

  // offer card touch pannina keela products-ku scroll aagum
  useEffect(() => {
    if (activeId && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeId])

  const browseAll = () => {
    if (onBrowse) onBrowse(active.cat)
    navigate('/')
  }

  return (
    <div className="page-wrapper">
      <button className="page-back" onClick={() => navigate('/')}>← Back</button>
      <h1 className="page-title"><Icon name="gift" /> Special Offers</h1>

      <div className="offers-grid-page">
        {OFFERS.map((o) => (
          <button
            key={o.id}
            type="button"
            className="offer-card-page"
            style={{ background: o.color }}
            aria-pressed={activeId === o.id}
            onClick={() => setActiveId(o.id)}
          >
            <span>
              <span className="offer-page-title">{o.title}</span>
              <span className="offer-page-sub">{o.sub}</span>
              <span className="offer-page-btn">{activeId === o.id ? 'Showing below ↓' : 'See products'}</span>
            </span>
            <span className="offer-page-emoji"><Icon name={o.icon} /></span>
          </button>
        ))}
      </div>

      {!active && <p className="offer-hint">Tap an offer to see the products</p>}

      {active && (
        <section ref={panelRef} className="offer-panel" style={{ '--offer-color': active.color }}>
          <div className="offer-panel-head">
            <span className="offer-panel-emoji"><Icon name={active.icon} /></span>
            <div className="offer-panel-text">
              <h2 className="offer-panel-title">{active.title}</h2>
              <p className="offer-panel-msg">{active.headline}</p>
            </div>
            <span className="product-count">{products.length} items</span>
          </div>

          <div className="product-grid">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                qty={cart[p.id] || 0}
                onAdd={addToCart}
                onInc={increment}
                onDec={decrement}
              />
            ))}
          </div>

          <button type="button" className="offer-browse" onClick={browseAll}>
            See all {active.browseLabel} →
          </button>
        </section>
      )}
    </div>
  )
}
