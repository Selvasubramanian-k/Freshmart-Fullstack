import { useState } from 'react'
import ProductImage from './ProductImage.jsx'
import Icon from './Icon.jsx'
import { resolveImage } from '../../shared/utils/images.js'

const PAY_NAMES = { gpay: 'GPay', phonepe: 'PhonePe', paytm: 'Paytm', bhim: 'BHIM', card: 'Card', nb: 'Net Banking', cod: 'Cash on Delivery' }
const SLOT_ETA  = { now: 'Within 10 minutes', hour: 'In about 1 hour', night: 'Tonight, 7:00 to 9:00 pm', morn: 'Tomorrow, 7:00 to 9:00 am' }

// result = backend response: { group_id, bill, orders: [ ...one per store ] }
function OrderSuccess({ onBack, onTrack, result }) {
  const [showOrders, setShowOrders] = useState(false)

  const { bill, orders = [] } = result
  const first    = orders[0]
  const items    = orders.flatMap(o => o.items)
  const payment  = first?.payment
  const isCOD    = payment?.method === 'cod'

  return (
    <div className="os-root">
      <div className="os-card">

        {/* Checkmark */}
        <div className="os-check-wrap">
          <div className="os-check-ring" />
          <div className="os-check-circle">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <path
                d="M14 26L22 34L38 18"
                stroke="white"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="os-check-path"
              />
            </svg>
          </div>
        </div>

        <h2 className="os-title">Order Placed Successfully!</h2>
        <p className="os-orderno">Order #{result.group_id}{orders.length > 1 ? ` · split into ${orders.length} store deliveries` : ''}</p>
        <p className="os-sub">
          Thank you for shopping with <strong>FreshMart</strong>.<br />
          Your fresh groceries are on their way!
        </p>

        {/* Info strips */}
        <div className="os-info-strips">
          <div className="os-strip">
            <span className="os-strip-icon"><Icon name="package" /></span>
            <div>
              <p className="os-strip-label">Order Status</p>
              <p className="os-strip-value">Placed · waiting for store to confirm</p>
            </div>
          </div>
          <div className="os-strip">
            <span className="os-strip-icon"><Icon name="truck" /></span>
            <div>
              <p className="os-strip-label">Estimated Delivery</p>
              <p className="os-strip-value">{SLOT_ETA[first?.slot] || 'Within 30–45 minutes'}</p>
            </div>
          </div>
          <div className="os-strip">
            <span className="os-strip-icon"><Icon name={isCOD ? 'banknote' : 'credit-card'} /></span>
            <div>
              <p className="os-strip-label">Payment</p>
              <p className="os-strip-value">
                {isCOD ? `Pay ₹${bill.total.toFixed(2)} at the door` : `Paid via ${PAY_NAMES[payment?.method] || 'online'}`}
                {payment?.transaction_id && <span className="os-txn"> · {payment.transaction_id}</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="os-btns">
          <button className="os-btn-primary" onClick={onBack}>
            <Icon name="shopping-cart" /> Continue Shopping
          </button>
          <button className="os-btn-secondary" onClick={() => setShowOrders(o => !o)}>
            <Icon name="clipboard-list" /> {showOrders ? 'Hide Items' : 'View Items'}
          </button>
          <button className="os-btn-secondary" onClick={onTrack}>
            <Icon name="truck" /> Track Order
          </button>
        </div>

        {/* Order items panel */}
        {showOrders && (
          <div className="os-order-panel">
            <h3 className="os-order-panel-title"><Icon name="receipt" /> Your Order</h3>

            {items.length === 0 ? (
              <p style={{ textAlign:'center', color:'#aaa', fontSize:13 }}>No items found.</p>
            ) : (
              <>
                {items.map((it) => (
                  <div className="os-order-item" key={it.pid}>
                    <ProductImage className="os-order-img" product={{ name: it.name, img: resolveImage(it.image_url) }} />
                    <div className="os-order-info">
                      <p className="os-order-name">{it.name}</p>
                      <p className="os-order-meta">{it.unit} × {it.quantity}</p>
                    </div>
                    <p className="os-order-price">₹{it.line_total.toFixed(2)}</p>
                  </div>
                ))}

                <div className="os-order-totals">
                  <div className="os-order-row"><span>Subtotal</span><span>₹{bill.subtotal.toFixed(2)}</span></div>
                  <div className="os-order-row"><span>Delivery</span><span>₹{bill.delivery_fee.toFixed(2)}</span></div>
                  {bill.tip > 0 && <div className="os-order-row"><span>Tip</span><span>₹{bill.tip.toFixed(2)}</span></div>}
                  {bill.coupon_discount > 0 && <div className="os-order-row"><span>Coupon</span><span>−₹{bill.coupon_discount.toFixed(2)}</span></div>}
                  {bill.payment_discount > 0 && <div className="os-order-row"><span>Payment offer</span><span>−₹{bill.payment_discount.toFixed(2)}</span></div>}
                  <div className="os-order-row os-order-grand"><span>{isCOD ? 'To pay' : 'Total Paid'}</span><span>₹{bill.total.toFixed(2)}</span></div>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default OrderSuccess