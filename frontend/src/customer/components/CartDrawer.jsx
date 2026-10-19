import { useNavigate, useLocation } from 'react-router-dom'
import { getProduct, DELIVERY } from '../data/products.js'
import ProductImage from './ProductImage.jsx'
import { getPersonalRecommendations } from '../utils/recommend.js'
import Icon from './Icon.jsx'



function CartDrawer({ isOpen, onClose, onOpen, cart, addToCart, increment, decrement, removeItem, orders = [] }) {
  const navigate = useNavigate()
  const location = useLocation() 
  const isCheckout = location.pathname === '/checkout'
  const getP     = (id) => getProduct(id)

  const entries  = Object.entries(cart).filter(([, q]) => q > 0)
  const subtotal = entries.reduce((s, [id, q]) => s + (getP(id)?.price || 0) * q, 0)
  const total    = subtotal + (subtotal > 0 ? DELIVERY : 0)
  const totalQty = entries.reduce((s, [, q]) => s + q, 0)

  // Cart + previous orders based suggestions (milk -> sugar, tea powder, coffee powder)
  const suggestions = getPersonalRecommendations({ cart, orders, limit: 4 })

  const goCheckout = () => { onClose(); navigate('/checkout') }

  return (
    <>
      <div className={`drawer-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose} />

      <aside className={`cart-drawer ${isOpen ? 'open' : ''}`}>

        <div className="drawer-header">
          <button className="drawer-back" onClick={onClose}>← Back</button>
          <span className="drawer-title">
            <Icon name="shopping-cart" /> Cart
            {totalQty > 0 && <span className="drawer-badge">{totalQty}</span>}
          </span>
          <button className="drawer-close" onClick={onClose}><Icon name="x" /></button>
        </div>

        <div className="drawer-items">
          {entries.length === 0 ? (
            <div className="drawer-empty">
              <span className="drawer-empty-icon"><Icon name="shopping-cart" /></span>
              <p style={{ fontWeight: 700 }}>Your cart is empty</p>
              <p style={{ fontSize: 13 }}>Add some fresh items!</p>
            </div>
          ) : entries.map(([id, qty]) => {
            const p = getP(id)
            if (!p) return null
            return (
              <div className="cart-item-row" key={id}>
                <ProductImage className="cart-item-img" product={p} />
                <div className="cart-item-info">
                  <p className="cart-item-name">{p.name}</p>
                  <p className="cart-item-price">₹{p.price * qty}</p>
                  <div className="qty-stepper" style={{ marginTop: 4 }}>
                    <button className="qty-btn" onClick={() => decrement(Number(id))}>−</button>
                    <span className="qty-num">{qty}</span>
                    <button className="qty-btn" onClick={() => increment(Number(id))}>+</button>
                  </div>
                </div>
                <button className="cart-item-remove" onClick={() => removeItem(Number(id))}><Icon name="trash" /></button>
              </div>
            )
          })}

          {suggestions.length > 0 && (
            <div className="drawer-suggest">
              <p className="drawer-suggest-title"><Icon name="sparkles" /> You may also need</p>
              {suggestions.map(({ product, reason }) => (
                <div className="suggest-row" key={product.id}>
                  <ProductImage className="cart-item-img" product={product} />
                  <div className="cart-item-info">
                    <p className="cart-item-name">{product.name}</p>
                    <p className="suggest-reason">{reason}</p>
                    <p className="cart-item-price">₹{product.price}</p>
                  </div>
                  <button className="suggest-add" onClick={() => addToCart(product)}>+ Add</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {entries.length > 0 && (
          <div className="drawer-footer">
            <div className="summary-row"><span>Subtotal</span><span>₹{subtotal}</span></div>
            <div className="summary-row"><span>Delivery</span><span>₹{DELIVERY}</span></div>
            <div className="summary-row total"><span>Total</span><span>₹{total}</span></div>
            <button className="btn-checkout" onClick={goCheckout}>Proceed to Checkout →</button>
          </div>
        )}

      </aside>

      {totalQty > 0 && !isOpen && !isCheckout && (
        <button className="cart-float" onClick={onOpen} aria-label={`View cart, ${totalQty} items, ₹${subtotal}`}>
          <span className="cf-thumbs">
            {entries.slice(0, 3).map(([id]) => (
              <span className="cf-thumb" key={id}><ProductImage product={getP(id)} /></span>
            ))}
            {entries.length > 3 && <span className="cf-thumb cf-more">+{entries.length - 3}</span>}
          </span>
          <span className="cf-text">
            <span className="cf-label">View cart</span>
            <span className="cf-count">{totalQty} item{totalQty > 1 ? 's' : ''}</span>
          </span>
          <span className="cf-total">₹{subtotal}</span>
          <span className="cf-arrow"><Icon name="chevron-right" /></span>
        </button>
      )}
    </>
  )
}

export default CartDrawer