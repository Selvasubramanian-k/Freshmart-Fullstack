import { CATEGORIES } from '../data/categories.js'
import { PRODUCTS } from '../data/products.js'
import ProductImage from './ProductImage.jsx'

// Zepto "Shop by Category" maathiri tiles. Tile photo = antha category la first product image.
export default function CategoryGrid({ onCategory }) {
  const tiles = CATEGORIES.filter((c) => c.id !== 'all').map((c) => ({
    ...c,
    product: PRODUCTS.find((p) => p.cat === c.id),
  }))

  return (
    <section className="cg-section">
      <h2 className="zs-title">Shop by Category</h2>
      <div className="cg-grid">
        {tiles.map((t) => (
          <button key={t.id} type="button" className="cg-tile" onClick={() => onCategory(t.id)}>
            <span className="cg-img">
              {t.product ? <ProductImage product={t.product} /> : <span className="cg-emoji">{t.icon}</span>}
            </span>
            <span className="cg-label">{t.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
