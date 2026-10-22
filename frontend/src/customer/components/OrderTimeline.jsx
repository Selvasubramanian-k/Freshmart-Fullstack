import { useNavigate } from 'react-router-dom'
import { Check, Phone, ReceiptText, Store, Package, Bike, House, XCircle, RotateCcw } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
//  My Orders: vertical status timeline.
//    done steps    -> small card with time
//    current step  -> big card (status line, message, icon, rider / code / buttons)
//    next steps    -> grey card with a faint icon
//  Cancelled / return orders get an extra red / amber card at the end.
// ─────────────────────────────────────────────────────────────
const FLOW = ['placed', 'confirmed', 'packed', 'out_for_delivery', 'delivered']
const ICONS = [ReceiptText, Store, Package, Bike, House]
const TITLES = ['Order placed', 'Confirmed by store', 'Packed and ready', 'Out for delivery', 'Delivered']
const VEHICLE = { bike: 'Bike', scooter: 'Scooter', cycle: 'Cycle' }

const toDate = (iso) => new Date(/Z$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`)
const hhmm = (iso) => (iso ? toDate(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '')
const rs = (n) => `₹${Math.round(Number(n || 0))}`

function stepTexts(i, o) {
  const store = o.store_name || 'The store'
  const rider = o.partner?.name?.split(' ')[0]
  const cod = o.payment?.method === 'cod'
  const at = (s) => hhmm(o.status_history.find((h) => h.status === s)?.at)
  return [
    { status: cod ? `Pay ${rs(o.bill.total)} cash on delivery` : 'Payment received',
      text: `Your order #${o.order_number} is placed. ${store} will accept it shortly.`,
      short: cod ? 'Cash on delivery' : 'Paid online' },
    { status: `${store} accepted`,
      text: rider ? `${rider} will pick it up as soon as it is packed.` : 'The store is picking your items. A delivery partner near the store will be assigned.',
      short: store },
    { status: rider ? `${rider} is coming to the store` : 'Finding a delivery partner',
      text: 'Your items are packed and waiting at the counter.',
      short: 'Ready for pickup' },
    { status: rider ? `${rider} is on the way` : 'Store staff is on the way',
      text: rider ? `${rider} picked up your order and is riding to you. Share the code only at your door.` : 'The store\u2019s own staff is bringing your order.',
      short: rider ? `Picked up by ${o.partner.name}` : 'Out with store staff' },
    { status: `Delivered at ${at('delivered')}${rider ? ` by ${o.partner.name}` : ''}`,
      text: 'Enjoy your groceries! Something not right? Raise a return or report an issue below.',
      short: 'Handed over' },
  ][i]
}

export default function OrderTimeline({ order: o, onIssue, onRefresh }) {
  const navigate = useNavigate()
  const history = o.status_history || []
  const timeOf = (s) => hhmm(history.find((h) => h.status === s)?.at)

  // where are we in the normal flow?
  const extra = ['cancelled', 'return_requested', 'returned'].includes(o.status) ? o.status : null
  let stage = FLOW.indexOf(o.status)
  if (extra === 'cancelled') stage = Math.max(...history.map((h) => FLOW.indexOf(h.status)), 0) + 1 // steps before cancel are done
  if (extra && extra !== 'cancelled') stage = FLOW.length // all done, return card after
  const live = !extra && stage < 4

  return (
    <div className="ot">
      <ol className="ot-list">

        {FLOW.map((s, i) => {
          if (extra === 'cancelled' && i >= stage) return null
          const Icon = ICONS[i]
          const t = stepTexts(i, o)
          const state = i < stage ? 'done' : i === stage ? 'now' : 'next'
          return (
            <li key={s} className={`ot-step ${state}`}>
              <span className="ot-dot" aria-hidden="true">{state === 'done' && <Check size={13} strokeWidth={4} />}</span>

              {state === 'done' && (
                <div className="ot-card small">
                  <div><b>{TITLES[i]}</b><span>{t.short}</span></div>
                  <time>{timeOf(s)}</time>
                </div>
              )}

              {state === 'next' && (
                <div className="ot-card faint">
                  <span>{TITLES[i]}</span>
                  <Icon size={24} aria-hidden="true" />
                </div>
              )}

              {state === 'now' && (
                <div className="ot-card big">
                  <div className="ot-head">
                    <div><b>{TITLES[i]}</b><span>{t.status}</span></div>
                    <span className="ot-ic"><Icon size={30} strokeWidth={1.8} aria-hidden="true" /></span>
                  </div>
                  <p>{t.text}</p>

                  {s === 'out_for_delivery' && (
                    <>
                      {o.partner && (
                        <div className="ot-rider">
                          <span className="ot-av">{o.partner.name.charAt(0)}</span>
                          <div><b>{o.partner.name}</b><small>{VEHICLE[o.partner.vehicle?.type] || 'Rider'}{o.partner.vehicle?.number ? ` · ${o.partner.vehicle.number}` : ''}</small></div>
                          {o.partner.phone && <a href={`tel:+91${o.partner.phone}`} aria-label={`Call ${o.partner.name}`}><Phone size={18} /></a>}
                        </div>
                      )}
                      {o.delivery_code && <div className="ot-code"><span>Delivery code</span><b>{o.delivery_code.split('').join(' ')}</b></div>}
                    </>
                  )}

                  {live && (
                    <button type="button" className="ot-btn" onClick={() => navigate(`/track/${o.id}`)}>
                      {s === 'out_for_delivery' ? 'Track live on map' : 'Track order'}
                    </button>
                  )}
                  {s === 'delivered' && onIssue && (
                    <button type="button" className="ot-btn ghost" onClick={onIssue}>Return / report issue</button>
                  )}
                </div>
              )}
            </li>
          )
        })}

        {extra && (
          <li className={`ot-step now ${extra === 'cancelled' ? 'bad' : 'warn'}`}>
            <span className="ot-dot" aria-hidden="true" />
            <div className="ot-card big">
              <div className="ot-head">
                <div>
                  <b>{extra === 'cancelled' ? 'Order cancelled' : extra === 'returned' ? 'Returned and refunded' : 'Return requested'}</b>
                  <span>{timeOf(extra) && `at ${timeOf(extra)}`}</span>
                </div>
                <span className="ot-ic">{extra === 'cancelled' ? <XCircle size={30} strokeWidth={1.8} /> : <RotateCcw size={30} strokeWidth={1.8} />}</span>
              </div>
              <p>
                {history.find((h) => h.status === extra)?.note
                  || (extra === 'cancelled' ? 'This order will not be delivered.' : extra === 'returned' ? 'Your refund has been processed.' : 'The store will review your request.')}
              </p>
            </div>
          </li>
        )}
      </ol>

      {live && onRefresh && <button type="button" className="ot-refresh" onClick={onRefresh}>Refresh status</button>}
    </div>
  )
}
