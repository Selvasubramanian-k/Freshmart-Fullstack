import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProductImage from '../components/ProductImage.jsx'
import OrderTimeline from '../components/OrderTimeline.jsx'
import Icon from '../components/Icon.jsx'
import Avatar, { AvatarPicker } from '../components/Avatar.jsx'
import { readAddrs, saveAddrs } from '../utils/addresses.js'
import { raiseComplaint, loadComplaints, loadWallet, requestSummary } from '../utils/orderHistory.js'
import { getProduct } from '../data/products.js'
import { resolveImage } from '../../shared/utils/images.js'
import { useAuth } from '../../shared/context/AuthContext.jsx'

const TABS = [
  { id: 'orders',    label: 'Orders',           icon: 'shopping-bag' },
  { id: 'support',   label: 'Returns & Support', icon: 'headphones' },
  { id: 'addresses', label: 'Saved Addresses',  icon: 'map-pin' },
  { id: 'profile',   label: 'Profile',          icon: 'user' },
]

const STATUS_TEXT = {
  placed: 'Order placed', confirmed: 'Confirmed by store', packed: 'Packed and ready',
  out_for_delivery: 'Out for delivery', delivered: 'Order delivered', cancelled: 'Order cancelled',
  return_requested: 'Return requested', returned: 'Returned and refunded',
}
const ISSUE_TYPES = [
  { id: 'late_delivery', label: 'Late delivery' },
  { id: 'other',         label: 'Something else' },
]
const ISSUE_LABEL = {
  return: 'Return items', refund: 'Refund', damaged: 'Damaged item', missing_item: 'Missing item', wrong_item: 'Wrong item',
  quality: 'Quality issue', expired: 'Expired', late_delivery: 'Late delivery', other: 'Something else',
}
const PAY_NAMES = { exchange: 'Free exchange', gpay: 'GPay', phonepe: 'PhonePe', paytm: 'Paytm', bhim: 'BHIM', card: 'Card', nb: 'Net Banking', cod: 'Cash on Delivery' }

const fmtDate = (iso) => {
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z')
  const day = d.getDate()
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'
  const month = d.toLocaleString('en-IN', { month: 'short' })
  const time = d.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
  return `${day}${suffix} ${month} ${d.getFullYear()}, ${time}`
}
const rs = (n) => `₹${Number(n).toFixed(2)}`

function OrderCard({ order, request, onOrderAgain, onChanged }) {
  const navigate = useNavigate()
  const o = order.raw
  const live = ['placed', 'confirmed', 'packed', 'out_for_delivery'].includes(o.status)
  const [open, setOpen]       = useState(live)   // live orders open with the timeline showing
  const [issue, setIssue]     = useState(null)   // { type, text }
  const [busy, setBusy]       = useState(false)
  const [msg, setMsg]         = useState('')

  const canCancel = ['placed', 'confirmed'].includes(o.status)
  const reqOpen   = request && ['open', 'in_progress'].includes(request.status)
  const canIssue  = !['cancelled', 'returned', 'return_requested'].includes(o.status) && !reqOpen && !o.is_exchange
  const types     = ISSUE_TYPES
  const sum       = request ? requestSummary(request) : null
  // delivered -> refund / exchange page; still on the way -> short note to the store
  const startIssue = () => {
    if (o.status === 'delivered') { navigate(`/issue/${o.id}`); return }
    setMsg(''); setIssue({ type: types[0].id, text: '' })
  }

  const doCancel = () => navigate(`/cancel/${o.id}`)   // cancel page asks why, then confirms
  const submitIssue = async (e) => {
    e.preventDefault()
    if (issue.text.trim().length < 5) { setMsg('Please describe the problem (at least 5 characters).'); return }
    setBusy(true); setMsg('')
    try {
      await raiseComplaint(o.id, issue.type, issue.text.trim())
      setIssue(null)
      setMsg('Request sent. The store will reply under Returns & Support.')
      await onChanged()
    } catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }

  const tone = o.status === 'cancelled' ? 'bad' : ['delivered', 'returned'].includes(o.status) ? 'good' : 'live'

  return (
    <div className="acc-order">
      <button className="acc-order-top acc-order-toggle" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <div>
          <div className={`acc-order-status ${tone}`}>
            {STATUS_TEXT[o.status] || o.status}
            {o.status === 'delivered' && <span className="acc-tick"><Icon name="check" /></span>}
          </div>
          <div className="acc-order-date">{o.is_exchange && <span className="acc-ex-tag">Exchange for #{o.exchange_for}</span>}#{o.order_number} · {o.store_name} · {fmtDate(o.created_at)}</div>
        </div>
        <div className="acc-order-amt">{rs(o.bill.total)} <Icon name="chevron-right" /></div>
      </button>

      <div className="acc-thumbs">
        {o.items.map(it => (
          <div className="acc-thumb" key={it.pid} title={`${it.name} × ${it.quantity}`}>
            <ProductImage product={{ name: it.name, img: getProduct(it.pid)?.img || resolveImage(it.image_url) }} />
            {it.quantity > 1 && <span className="acc-qty">{it.quantity}</span>}
          </div>
        ))}
      </div>


      {sum && (
        <button type="button" className={`acc-issue-strip ${sum.tone}`} onClick={() => navigate(`/issue/${o.id}?c=${request.id}`)}>
          <span className="acc-issue-ic"><Icon name={sum.tone === 'wait' ? 'clock' : sum.tone === 'bad' || sum.tone === 'off' ? 'x' : 'check'} /></span>
          <span><b>{sum.title}</b><small>{sum.sub}</small></span>
          <em>View ›</em>
        </button>
      )}

      {open && (
        <div className="acc-order-detail">
          <OrderTimeline
            order={o}
            onRefresh={onChanged}
            onIssue={canIssue && !issue ? startIssue : null}
          />
          <div className="acc-lines">
            {o.items.map(it => (
              <div className="acc-row" key={it.pid}><span>{it.name} <span className="acc-muted">{it.unit} × {it.quantity}</span></span><b>{rs(it.line_total)}</b></div>
            ))}
            <div className="acc-row"><span className="acc-muted">Delivery</span><span>{rs(o.bill.delivery_fee)}</span></div>
            {o.bill.tip > 0 && <div className="acc-row"><span className="acc-muted">Tip</span><span>{rs(o.bill.tip)}</span></div>}
            {(o.bill.coupon_discount + o.bill.payment_discount) > 0 && (
              <div className="acc-row"><span className="acc-muted">Discounts</span><span>−{rs(o.bill.coupon_discount + o.bill.payment_discount)}</span></div>
            )}
            <div className="acc-row"><b>Total</b><b>{rs(o.bill.total)}</b></div>
            <div className="acc-row"><span className="acc-muted">Payment</span><span>{PAY_NAMES[o.payment.method]} · {o.payment.status}</span></div>
            <div className="acc-row"><span className="acc-muted">Deliver to</span><span className="acc-right-text">{o.address.label} · {o.address.text}</span></div>
          </div>
        </div>
      )}

      {issue && (
        <form className="acc-issue" onSubmit={submitIssue}>
          <div className="acc-chips">
            {types.map(t => (
              <button type="button" key={t.id} className={`acc-chip ${issue.type === t.id ? 'on' : ''}`} onClick={() => setIssue(s => ({ ...s, type: t.id }))}>{t.label}</button>
            ))}
          </div>
          <textarea className="acc-input" rows={3} placeholder="Tell us what went wrong" value={issue.text}
            onChange={(e) => setIssue(s => ({ ...s, text: e.target.value }))} />
          <div className="acc-actions">
            <button type="button" className="acc-again" onClick={() => setIssue(null)}>Close</button>
            <button type="submit" className="acc-primary" disabled={busy}>Send request</button>
          </div>
        </form>
      )}

      {msg && <p className="acc-msg">{msg}</p>}

      <div className="acc-actions">
        <button className="acc-again" onClick={() => onOrderAgain(order.items)}>Order Again</button>
        {canCancel && <button className="acc-again danger" disabled={busy} onClick={doCancel}>Cancel order</button>}
        {canIssue && !issue && (
          <button className="acc-again" onClick={startIssue}>
            {o.status === 'delivered' ? 'Refund / Exchange' : 'Report issue'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Account({ user, orders, increment, onLogout, onOpenCart, onRefresh }) {
  const navigate = useNavigate()
  const { updateProfile } = useAuth()
  const [tab, setTab] = useState('orders')
  const [showList, setShowList] = useState(true) // mobile: list <-> detail

  const [addrs, setAddrs] = useState(() => readAddrs(user))
  const [addrForm, setAddrForm] = useState({ label: 'Home', text: '' })

  const [complaints, setComplaints] = useState([])
  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '' })
  const [profileMsg, setProfileMsg] = useState('')

  const [wallet, setWallet] = useState(0)
  const reloadComplaints = () => {
    loadComplaints().then(setComplaints).catch(() => {})
    loadWallet().then((w) => setWallet(w.balance)).catch(() => {})
  }
  useEffect(() => { reloadComplaints() }, [])
  // latest refund / exchange request for each order (an active one wins over a cancelled one)
  const reqByOrder = {}
  complaints.filter(c => c.resolution).forEach(c => {
    const had = reqByOrder[c.order_id]
    if (!had || (had.status === 'cancelled' && c.status !== 'cancelled')) reqByOrder[c.order_id] = c
  })
  const itemReqs = complaints.filter(c => c.resolution)
  const openReqs = itemReqs.filter(c => ['open', 'in_progress'].includes(c.status))
  const closedReqs = itemReqs.filter(c => !['open', 'in_progress'].includes(c.status))
  const simple = complaints.filter(c => !c.resolution)
  const refunded = itemReqs.filter(c => c.status === 'resolved' && c.resolution === 'refund').reduce((a, c) => a + (c.amount || 0), 0)

  const sub = user?.phone ? `+91 ${user.phone}` : user?.email || ''

  const pick = (id) => { setTab(id); setShowList(false) }

  const orderAgain = (items) => {
    items.forEach(([id, qty]) => { for (let i = 0; i < qty; i++) increment(id) })
    onOpenCart()
  }
  const onChanged = async () => { await onRefresh(); await reloadComplaints() }

  const addAddress = (e) => {
    e.preventDefault()
    if (!addrForm.text.trim()) return
    const next = [...addrs, { id: Date.now(), label: addrForm.label, text: addrForm.text.trim() }]
    setAddrs(next); saveAddrs(user, next)
    setAddrForm({ label: 'Home', text: '' })
  }
  const removeAddress = (id) => {
    const next = addrs.filter(a => a.id !== id)
    setAddrs(next); saveAddrs(user, next)
  }

  const saveProfile = async (e) => {
    e.preventDefault()
    setProfileMsg('')
    if (!/^[6-9]\d{9}$/.test(profile.phone)) { setProfileMsg('Enter a valid 10-digit mobile number.'); return }
    try { await updateProfile({ name: profile.name.trim(), phone: profile.phone }); setProfileMsg('Profile updated.') }
    catch (err) { setProfileMsg(err.message) }
  }

  const history = [...orders].reverse()
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))

  return (
    <div className="acc-page">
      <div className="acc-shell">
        <button type="button" className="acc-exit" aria-label="Go back" onClick={goBack}>
          <span aria-hidden="true">←</span> Back
        </button>

        {/* ───── LEFT ───── */}
        <aside className={`acc-left ${showList ? '' : 'acc-hide-m'}`}>
          <div className="acc-user">
            <Avatar user={user} size={56} />
            <div>
              <h2 className="acc-name">{user?.name || 'Guest'}</h2>
              <p className="acc-sub">{sub}</p>
            </div>
          </div>
          <AvatarPicker user={user} onPick={() => setTimeout(goBack, 450)} />

          <button className="acc-wallet" onClick={() => navigate('/offers')}>
            <div className="acc-wallet-top">
              <span><Icon name="wallet" /> FreshMart Cash &amp; Gift Card</span><span><Icon name="chevron-right" /></span>
            </div>
            <div className="acc-wallet-bottom">
              <span>Available Balance: <b>₹{Number(wallet).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b></span>
              <span className="acc-wallet-btn">Add Balance</span>
            </div>
          </button>

          <nav className="acc-menu">
            {TABS.map(t => (
              <button key={t.id} className={`acc-menu-item ${tab === t.id ? 'active' : ''}`} onClick={() => pick(t.id)}>
                <span className="acc-menu-icon"><Icon name={t.icon} /></span>{t.label}
              </button>
            ))}
          </nav>

          <button className="acc-logout" onClick={onLogout}>Log Out</button>
        </aside>

        {/* ───── RIGHT ───── */}
        <section className={`acc-right ${showList ? 'acc-hide-m' : ''}`}>
          <div className="acc-right-head">
            <button className="acc-back" aria-label="Back" onClick={() => setShowList(true)}>‹</button>
            <span>{TABS.find(t => t.id === tab)?.label}</span>
          </div>

          <div className="acc-right-body">

            {/* ORDERS */}
            {tab === 'orders' && (
              history.length === 0 ? (
                <div className="acc-empty">
                  <div className="acc-empty-emoji"><Icon name="shopping-cart" /></div>
                  <p>No orders yet</p>
                  <button className="acc-primary" onClick={() => navigate('/')}>Start shopping</button>
                </div>
              ) : history.map(o => (
                <OrderCard key={o.id} order={o} request={reqByOrder[o.id]} onOrderAgain={orderAgain} onChanged={onChanged} />
              ))
            )}

            {/* SUPPORT: returns + complaints */}
            {tab === 'support' && (
              <>
                <div className="acc-req-stats">
                  <div className="acc-card"><b className="acc-big">{openReqs.length}</b><span className="acc-muted">Open requests</span></div>
                  <div className="acc-card"><b className="acc-big good">₹{Number(refunded).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b><span className="acc-muted">Refunded so far</span></div>
                </div>
                {itemReqs.length === 0 && simple.length === 0 && (
                  <div className="acc-card">
                    <h3>How can we help?</h3>
                    <p className="acc-muted">Problem with an item? Open the order under <b>Orders</b> and tap <b>Refund / Exchange</b>. You can follow every step here.</p>
                    <button className="acc-primary" onClick={() => pick('orders')}>Go to my orders</button>
                  </div>
                )}
                {[['OPEN', openReqs], ['CLOSED', closedReqs]].map(([label, list]) => list.length > 0 && (
                  <div key={label} className="acc-req-list">
                    <p className="acc-req-group">{label}</p>
                    {list.map(c => {
                      const sm = requestSummary(c)
                      return (
                        <button type="button" key={c.id} className="acc-req" onClick={() => navigate(`/issue/${c.order_id}?c=${c.id}`)}>
                          <span className="acc-req-top"><b>{sm.kind} · ₹{Number(c.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b><span className={`acc-req-pill ${sm.tone}`}>{sm.pill}</span></span>
                          <small>#{c.order_number} · {sm.sub}</small>
                          {sm.next && <p>{sm.tone === 'wait' || sm.tone === 'ok' ? `Next: ${sm.next}` : sm.next}</p>}
                          {sm.tone === 'done' && <p>{sm.title}</p>}
                        </button>
                      )
                    })}
                  </div>
                ))}
                {simple.map(c => (
                  <div className="acc-card" key={c.id}>
                    <div className="acc-row">
                      <b>{ISSUE_LABEL[c.type] || c.type} · #{c.order_number}</b>
                      <span className={`acc-pill ${c.status}`}>{c.status.replace('_', ' ')}</span>
                    </div>
                    <p className="acc-muted">{c.description}</p>
                    {c.response && <p className="acc-reply"><b>Store reply:</b> {c.response}</p>}
                    <p className="acc-muted acc-small">{fmtDate(c.created_at)}</p>
                  </div>
                ))}
                <div className="acc-card">
                  <p className="acc-muted">Anything else?</p>
                  <button className="acc-again" onClick={() => navigate('/contact')}>Contact FreshMart</button>
                </div>
              </>
            )}

            {/* ADDRESSES */}
            {tab === 'addresses' && (
              <>
                {addrs.map(a => (
                  <div className="acc-card acc-addr" key={a.id}>
                    <div>
                      <b>{a.label}</b>
                      <p className="acc-muted">{a.text}</p>
                    </div>
                    <button className="acc-del" onClick={() => removeAddress(a.id)}>Delete</button>
                  </div>
                ))}
                <form className="acc-card" onSubmit={addAddress}>
                  <h3>Add new address</h3>
                  <div className="acc-chips">
                    {['Home', 'Work', 'Other'].map(l => (
                      <button type="button" key={l} className={`acc-chip ${addrForm.label === l ? 'on' : ''}`} onClick={() => setAddrForm(f => ({ ...f, label: l }))}>{l}</button>
                    ))}
                  </div>
                  <textarea
                    className="acc-input"
                    rows={3}
                    placeholder="Flat / street / area / pincode"
                    value={addrForm.text}
                    onChange={(e) => setAddrForm(f => ({ ...f, text: e.target.value }))}
                  />
                  <button type="submit" className="acc-primary">Save address</button>
                </form>
              </>
            )}

            {/* PROFILE */}
            {tab === 'profile' && (
              <form className="acc-card" onSubmit={saveProfile}>
                <label className="acc-muted" htmlFor="pf-name">Name</label>
                <input id="pf-name" className="acc-input" value={profile.name} onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))} />
                <label className="acc-muted" htmlFor="pf-phone">Mobile number</label>
                <input id="pf-phone" className="acc-input" inputMode="numeric" value={profile.phone}
                  onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
                <div className="acc-row"><span className="acc-muted">Email</span><b>{user?.email}</b></div>
                <div className="acc-row"><span className="acc-muted">Orders placed</span><b>{orders.length}</b></div>
                {profileMsg && <p className="acc-msg">{profileMsg}</p>}
                <button type="submit" className="acc-primary">Save changes</button>
              </form>
            )}

          </div>
        </section>
      </div>
    </div>
  )
}
