import ProductImage from './ProductImage.jsx'
import Icon from './Icon.jsx'

function ProductCard({product,qty,onAdd,onInc,onDec,reason}) {
  const soldOut = product.stock === 0
  return (
    <div className={`product-card ${soldOut ? 'is-soldout' : ''}`}>
         {product.discount && (
        <span className="product-badge">{product.discount}%</span>
      )}
      <div className="product-img-wrap">
        <ProductImage className="product-img" product={product} />
      </div>
      
      <div className="product-body">
        <h3 className="product-name">{product.name}</h3>
        <p className="product-unit">
          {product.unit}
          {!soldOut && product.stock <= 5 && <span className="stock-low"> · Only {product.stock} left</span>}
        </p>
        {reason && <p className="product-reason">{reason}</p>}

        <div className="product-footer">
          <div className="price-block">
            {product.oldPrice && (
              <span className="price-old">₹{product.oldPrice.toFixed(2)}</span>
            )}
            <span className="price-new">₹{product.price.toFixed(2)}</span>
          </div>

          {soldOut ? (
            <button className="btn-add-cart" disabled>Sold out</button>
          ) : qty === 0 ? (
            <button className="btn-add-cart" onClick={() => onAdd(product)}>
              <Icon name="shopping-cart" /> Cart
            </button>
          ) : (
            <div className="qty-stepper">
              <button className="qty-btn" onClick={() => onDec(product.id)}>−</button>
              <span className="qty-num">{qty}</span>
              <button className="qty-btn" disabled={qty >= product.stock} onClick={() => onInc(product.id)}>+</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProductCard