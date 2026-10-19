import { useState, useMemo } from 'react'
import ProductCard from './ProductCard'
import { PRODUCTS } from '../data/products.js'
import Icon from './Icon.jsx'


const FILTERS  = ['All', 'Organic', 'On Sale', 'Popular', 'New Arrival']
const CAT_LABELS = {
  all:'All Products', fruits:'Fruits & Vegetables', meat:'Meat & Fish',
  dairy:'Dairy', breakfast:'Breakfast', beverage:'Beverage',
  snacks:'Snacks', home:'Home & Cleaning', health:'Health & Beauty',
  petcare:'Pet Care', cooking:'Cooking',
}

function ProductList({ activeCat, cart, addToCart, increment, decrement, searchQuery }) {  

  const [activeFilter, setFilter] = useState('All')

  const filtered = useMemo(() => PRODUCTS.filter(p => {
    const catOk    = activeCat === 'all' || p.cat === activeCat
    const filterOk = activeFilter === 'All'
      || (activeFilter === 'On Sale'     && p.discount)
      || (activeFilter === 'Organic'     && p.tag === 'organic')
      || (activeFilter === 'Popular'     && p.tag === 'popular')
      || (activeFilter === 'New Arrival' && p.tag === 'new')

    
    const searchOk = searchQuery === ''
      || p.name.toLowerCase().includes(searchQuery.toLowerCase())

    return catOk && filterOk && searchOk 
  }), [activeCat, activeFilter, searchQuery])
  return (
    <div>
        {/* Section header */}
      <div className="section-header">
        <h2 className="section-title">
          <Icon id={activeCat} /> {CAT_LABELS[activeCat] || 'All Products'}
          <span className="product-count">{filtered.length} items</span>
        </h2>
        
      </div>

      {/* Filter chips */}
      <div className="filter-bar">
        {FILTERS.map(f => (
          <button
            key={f}
            className={`filter-chip ${activeFilter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

        {/* Grid */}
      {filtered.length === 0 ? (
        <div className="grid-empty">
          <span className="grid-empty-icon"><Icon name="search" /></span>
          <p style={{ fontWeight: 700, fontSize: 16 }}>No products found</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>Try a different category or filter.</p>
        </div>
      ) : (
        <div className="product-grid">
          {filtered.map(p => (
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
      )}


    </div>

    
   

  )
}

export default ProductList