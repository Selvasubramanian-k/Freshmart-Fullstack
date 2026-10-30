import { useState, useEffect, useRef } from 'react'
import { getProduct, DELIVERY } from '../data/products.js'
import ProductImage from './ProductImage.jsx'
import Icon from './Icon.jsx'
import { readAddrs, saveAddrs } from '../utils/addresses.js'
import PlacingOrder from './PlacingOrder.jsx'
import { useAuth } from '../../shared/context/AuthContext.jsx'
import { api } from '../../shared/api/client.js'

// ─────────────────────────────────────────────────────────────
//  Timeline checkout: Address -> Time & tip -> Payment (slide to pay)
//  Offers below are shown in the UI; backend (app/utils/pricing.py) same rules la total ah
//  thirumba calculate pannum. Maathanum na rendu edathulayum maathunga.
// ─────────────────────────────────────────────────────────────
// Coupons come from the FreshMart owner panel (Areas & offers); the backend checks them again at order time.

// type: 'pct' (percent off, capped) | 'flat' (rupees off) | 'cashback' (comes later, price same)
// Payment logos: src/assets/pay/<id>.png|svg|webp (gpay, phonepe, paytm, bhim) irundha adha kaattum, illaina letter fallback.
const PAY_LOGOS = import.meta.glob('../../assets/pay/*.{png,svg,webp,jpg,jpeg}', { eager: true, import: 'default' })
const LOGO_WORDS = { gpay: ['gpay', 'googlepay', 'google-pay', 'google_pay'], phonepe: ['phonepe', 'phone-pe', 'phone_pe'], paytm: ['paytm'], bhim: ['bhim'] }
const payLogo = (id) => {
  const words = LOGO_WORDS[id]
  if (!words) return null
  const k = Object.keys(PAY_LOGOS).find(p => {
    const f = p.split('/').pop().toLowerCase()
    return words.some(w => f.includes(w))
  })
  return k ? PAY_LOGOS[k] : null
}

const PAY_METHODS = [
  { group:'UPI',   id:'gpay',    logo:'G',  color:'#4285F4', name:'GPay',    sub:'Pay with GPay UPI',          offer:{ type:'pct',      value:10, cap:30, label:'10% off, up to ₹30' }, best:true },
  { group:'UPI',   id:'phonepe', logo:'P',  color:'#7a3fc4', name:'PhonePe', sub:'Pay with any bank account',  offer:{ type:'cashback', value:15,         label:'₹15 cashback later' } },
  { group:'UPI',   id:'paytm',   logo:'Pt', color:'#00a3d9', name:'Paytm',   sub:'UPI or Paytm balance',       offer:{ type:'flat',     value:10,         label:'₹10 off on first Paytm order' } },
  { group:'UPI',   id:'bhim',    logo:'B',  color:'#138808', name:'BHIM',    sub:'Any UPI app' },
  { group:'Cards', id:'card',    icon:'credit-card', name:'Credit / Debit Card', sub:'Visa, Mastercard, RuPay',        offer:{ type:'pct',      value:5,  cap:25, label:'5% off on cards' } },
  { group:'More',  id:'nb',      icon:'landmark', name:'Net Banking',         sub:'All major banks' },
  { group:'More',  id:'cod',     icon:'banknote', name:'Cash on Delivery',    sub:'Pay at the door' },
]
const GROUP_TITLES = { UPI:'Pay with UPI', Cards:'Cards', More:'More ways to pay' }

const BANKS = ['State Bank of India','HDFC Bank','ICICI Bank','Axis Bank','Kotak Bank','Punjab National Bank']

const SLOTS = [
  { id:'now',   title:'Now',       sub:'Arrives in 10 min' },
  { id:'hour',  title:'In 1 hour', sub:'About 60 min' },
  { id:'night', title:'Tonight',   sub:'7:00 to 9:00 pm' },
  { id:'morn',  title:'Tomorrow',  sub:'7:00 to 9:00 am' },
]
const INSTRUCTIONS = ['Leave at the door', 'Do not ring the bell', 'Call on arrival', 'Avoid calling']
const TIPS = [0, 10, 20, 30]


const rs = (n) => `₹${n.toFixed(2)}`

function methodOffer(method, base) {
  const o = method?.offer
  if (!o) return { off: 0, cashback: 0 }
  if (o.type === 'pct')      return { off: Math.min((base * o.value) / 100, o.cap), cashback: 0 }
  if (o.type === 'flat')     return { off: o.value, cashback: 0 }
  if (o.type === 'cashback') return { off: 0, cashback: o.value }
  return { off: 0, cashback: 0 }
}

function CheckoutPage({ cart, user, onBack, onPlaceOrder, increment, decrement }) {
  const [step, setStep]         = useState(1)
  const [stripOpen, setStrip]   = useState(false)
  const [error, setError]       = useState('')

  // address
  const [saved, setSaved]       = useState(() => readAddrs(user))
  const [addrId, setAddrId]     = useState(() => { const s = readAddrs(user); return s.length ? s[0].id : 'new' })
  const [newAddr, setNewAddr]   = useState({ label: 'Home', text: '' })
  const [locating, setLocating] = useState('')   // '' | 'busy' | 'ok' | error text
  const [instr, setInstr]       = useState({})

  // time & tip
  const [slot, setSlot]         = useState('now')
  const [tip, setTip]           = useState(10)

  // payment
  const [methodId, setMethodId] = useState('gpay')
  const [bank, setBank]         = useState('')
  const [card, setCard]         = useState({ no: '', name: '', exp: '', cvv: '' })
  const [couponText, setCouponText] = useState('')
  const [coupon, setCoupon]     = useState(null)     // { code, off }
  const [offers, setOffers]     = useState([])
  const [checking, setChecking] = useState(false)
  const [slide, setSlide]       = useState(0)
  const [placing, setPlacing]   = useState(false)
  // login la name ketkala -> mudhal order la mattum ketpom
  const { updateProfile } = useAuth()
  const needName = !user?.name?.trim()
  const [myName, setMyName]     = useState('')
  const placedRef               = useRef(false)   // double submit aagaama thadukka
  const snapRef                 = useRef(0)       // (hooks early return ku mela irukkanum)

  useEffect(() => { window.scrollTo(0, 0) }, [])

  const entries  = Object.entries(cart).filter(([, q]) => q > 0)
  const subtotal = entries.reduce((s, [id, q]) => s + (getProduct(id)?.price || 0) * q, 0)
  useEffect(() => { api.get('/api/coupons').then(setOffers).catch(() => {}) }, [])
  // cart changed after a coupon was applied -> check it again (min order / % off)
  const couponCode = coupon?.code
  useEffect(() => {
    if (!couponCode) return
    api.get(`/api/coupons/check?code=${couponCode}&subtotal=${subtotal}`)
      .then((c) => setCoupon((old) => (old && old.off === c.off ? old : c)))
      .catch((e) => { setCoupon(null); setError(e.message) })
  }, [subtotal, couponCode])
  const count    = entries.reduce((s, [, q]) => s + q, 0)

  const method      = PAY_METHODS.find(m => m.id === methodId)
  const couponOff   = coupon ? coupon.off : 0
  const base        = subtotal + DELIVERY - couponOff
  const { off: methodOff, cashback } = methodOffer(method, base)
  const total       = Math.max(0, base + tip - methodOff)
  const isCOD       = methodId === 'cod'

  const addr = saved.find(a => a.id === addrId)

  const applyCoupon = async (code) => {
    setError('')
    if (!code.trim()) { setError('Type a coupon code.'); return }
    setChecking(true)
    try { setCoupon(await api.get(`/api/coupons/check?code=${encodeURIComponent(code.trim())}&subtotal=${subtotal}`)) }
    catch (e) { setError(e.message) }
    finally { setChecking(false) }
  }
  const slotInfo = SLOTS.find(s => s.id === slot)
  const instrList = INSTRUCTIONS.filter((_, i) => instr[i])

  if (entries.length === 0) {
    return (
      <div className="ck-page">
        <button className="ck-back" onClick={onBack}>← Back to Shop</button>
        <div className="ck-card ck-empty">
          <div className="ck-empty-emoji"><Icon name="shopping-cart" /></div>
          <p>Your cart is empty</p>
          <button className="ck-btn" onClick={onBack}>Start shopping</button>
        </div>
      </div>
    )
  }

  // ── step 1: address ──
  const submitAddress = async () => {
    setError('')
    if (needName) {
      if (myName.trim().length < 2) { setError('Please enter your name, so the rider knows who to ask for.'); return }
      try { await updateProfile({ name: myName.trim() }) } catch (e) { setError(e.message); return }
    }
    if (addrId === 'new') {
      if (!newAddr.text.trim()) { setError('Please enter your delivery address.'); return }
      const entry = { id: Date.now(), label: newAddr.label, text: newAddr.text.trim(),
        ...(Number.isFinite(newAddr.lat) ? { lat: newAddr.lat, lng: newAddr.lng } : {}) }
      const next = [...saved, entry]
      setSaved(next); saveAddrs(user, next)
      setAddrId(entry.id)
      setNewAddr({ label: 'Home', text: '' })
      setLocating('')
    }
    setStep(2)
  }

  // GPS pin -> rider ku exact location theriyum (map la home pin)
  const useMyLocation = () => {
    if (!navigator.geolocation) { setLocating('Location is not supported on this browser.'); return }
    setLocating('busy')
    navigator.geolocation.getCurrentPosition(
      (p) => { setNewAddr(a => ({ ...a, lat: p.coords.latitude, lng: p.coords.longitude })); setLocating('ok') },
      () => setLocating('Could not get your location. Please allow location access.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  // ── step 3: pay ──
  const validatePayment = () => {
    if (methodId === 'nb' && !bank) return 'Please choose your bank.'
    if (methodId === 'card') {
      if (card.no.replace(/\s/g, '').length < 16) return 'Enter the 16-digit card number.'
      if (!card.name.trim())                      return 'Enter the name on the card.'
      if (!/^\d{2}\/\d{2}$/.test(card.exp))       return 'Enter expiry as MM/YY.'
      if (card.cvv.length < 3)                    return 'Enter the 3-digit CVV.'
    }
    return ''
  }

  // handle vittaa smooth ah thirumba left ku slide aagum (jump aagaadhu)
  const snapBack = (from) => {
    cancelAnimationFrame(snapRef.current)
    const dur = 320
    let t0 = null
    const step = (t) => {
      if (t0 === null) t0 = t
      const k = Math.min(1, (t - t0) / dur)
      setSlide(Math.round(from * (1 - (1 - Math.pow(1 - k, 3)))))
      if (k < 1) snapRef.current = requestAnimationFrame(step)
    }
    snapRef.current = requestAnimationFrame(step)
  }

  const finishSlide = (value = slide) => {
    if (placedRef.current) return
    if (value < 95) { snapBack(value); return }
    const msg = validatePayment()
    if (msg) { setError(msg); snapBack(100); return }
    setError('')
    placedRef.current = true
    setPlacing(true)
    const cardDigits = card.no.replace(/\s/g, '')
    onPlaceOrder({
      items: entries.map(([id, q]) => ({ pid: Number(id), quantity: q })),
      address: { label: addr?.label || 'Home', text: addr?.text || '',
        ...(Number.isFinite(addr?.lat) ? { lat: addr.lat, lng: addr.lng } : {}) },
      instructions: instrList,
      slot,
      tip,
      payment_method: methodId,
      coupon_code: coupon ? coupon.code : null,
      bank: methodId === 'nb' ? bank : null,
      card: methodId === 'card' ? { last4: cardDigits.slice(-4), name: card.name.trim() } : null,
    }).catch((err) => {
      // backend error (stock theernthuchu, store closed ...) -> kaatti, thirumba try panna vidum
      placedRef.current = false
      setPlacing(false)
      setError(err.message)
      snapBack(100)
    })
  }

  const timelineState = (n) => (step === n ? 'open' : step > n ? 'done' : '')

  const billRows = (
    <>
      <div className="ck-tr"><span>Subtotal</span><span>{rs(subtotal)}</span></div>
      <div className="ck-tr"><span>Delivery</span><span>{rs(DELIVERY)}</span></div>
      {tip > 0 && <div className="ck-tr"><span>Delivery partner tip</span><span>{rs(tip)}</span></div>}
      {couponOff > 0 && <div className="ck-tr good"><span>Coupon {coupon?.code}</span><span>−{rs(couponOff)}</span></div>}
      {methodOff > 0 && <div className="ck-tr good"><span>{method.name} offer</span><span>−{rs(methodOff)}</span></div>}
      {cashback > 0 && <div className="ck-tr good"><span>Cashback later</span><span>{rs(cashback)}</span></div>}
      <div className="ck-tr total"><span>To pay</span><span>{rs(total)}</span></div>
    </>
  )

  return (
    <div className="ck-page">
      {placing && <PlacingOrder cod={isCOD} />}
      <button className="ck-back" onClick={onBack}>← Back to Shop</button>
      <div className="ck-top"><h1 className="ck-title">Checkout</h1><span className="ck-secure"><Icon name="lock" /> Secure payment</span></div>

      {/* ORDER STRIP */}
      <div className={`ck-strip ${stripOpen ? 'open' : ''}`}>
        <button className="ck-strip-head" onClick={() => setStrip(o => !o)} aria-expanded={stripOpen}>
          <div className="ck-stack">
            {entries.slice(0, 5).map(([id]) => {
              const p = getProduct(id)
              return p ? <div className="ck-stack-img" key={id}><ProductImage product={p} /></div> : null
            })}
          </div>
          <div className="ck-strip-text">
            <b>{count} item{count > 1 ? 's' : ''}</b>
            <span>{stripOpen ? 'Tap to hide order' : 'Tap to view or edit order'}</span>
          </div>
          <div className="ck-strip-amt">{rs(total)}</div>
          <span className="ck-chev">⌄</span>
        </button>

        {stripOpen && (
          <div className="ck-strip-body">
            {entries.map(([id, qty]) => {
              const p = getProduct(id)
              if (!p) return null
              return (
                <div className="ck-item" key={id}>
                  <div className="ck-item-img"><ProductImage product={p} /></div>
                  <div className="ck-item-info">
                    <p className="ck-item-name">{p.name}</p>
                    <p className="ck-item-meta">{p.unit}</p>
                  </div>
                  <div className="ck-qty">
                    <button aria-label={`Remove one ${p.name}`} onClick={() => decrement(id)}>−</button>
                    <span>{qty}</span>
                    <button aria-label={`Add one ${p.name}`} onClick={() => increment(id)}>+</button>
                  </div>
                  <p className="ck-item-price">{rs(p.price * qty)}</p>
                </div>
              )
            })}
            <div className="ck-bill">{billRows}</div>
          </div>
        )}
      </div>

      {/* STEP 1: ADDRESS */}
      <div className={`ck-tl ${timelineState(1)}`}>
        <div className="ck-dot">{step > 1 ? <Icon name="check" /> : 1}</div>
        <div className="ck-th">
          <div>
            <b>Delivery address</b>
            {step > 1 && addr && (
              <div className="ck-sum">
                {addr.label} · {addr.text}{instrList.length ? ` · ${instrList.join(', ')}` : ''}
              </div>
            )}
          </div>
          {step > 1 && <button className="ck-edit" onClick={() => { setError(''); setStep(1) }}>Edit</button>}
        </div>

        {step === 1 && (
          <div className="ck-body">
            {needName && (
              <div className="ck-newaddr" style={{ marginBottom: 14 }}>
                <label className="ck-lab" htmlFor="ck-name">Your name</label>
                <input id="ck-name" className="ck-input" autoComplete="name" placeholder="e.g. Priya" value={myName}
                  onChange={(e) => { setMyName(e.target.value); setError('') }} />
              </div>
            )}
            <div className="ck-addrs">
              {saved.map(a => (
                <button key={a.id} className={`ck-addr ${addrId === a.id ? 'on' : ''}`} onClick={() => setAddrId(a.id)}>
                  <span className="ck-addr-ic">{a.label === 'Work' ? <Icon name="building" /> : a.label === 'Home' ? <Icon name="house" /> : <Icon name="map-pin" />}</span>
                  <div><b>{a.label}</b><span>{a.text}</span></div>
                </button>
              ))}
              <button className={`ck-addr ${addrId === 'new' ? 'on' : ''}`} onClick={() => setAddrId('new')}>
                <span className="ck-addr-ic">＋</span>
                <div><b>Add a new address</b></div>
              </button>
            </div>

            {addrId === 'new' && (
              <div className="ck-newaddr">
                <div className="ck-chips">
                  {['Home', 'Work', 'Other'].map(l => (
                    <button key={l} className={`ck-chip ${newAddr.label === l ? 'on' : ''}`} onClick={() => setNewAddr(a => ({ ...a, label: l }))}>{l}</button>
                  ))}
                </div>
                <label className="ck-lab" htmlFor="ck-addr-text">Flat, street, area and pincode</label>
                <textarea
                  id="ck-addr-text"
                  className="ck-input"
                  rows={3}
                  placeholder="No. 12, Gandhi Street, T Nagar, Chennai 600017"
                  value={newAddr.text}
                  onChange={(e) => setNewAddr(a => ({ ...a, text: e.target.value }))}
                />
                <button type="button" className={`ck-locate ${locating === 'ok' ? 'ok' : ''}`} onClick={useMyLocation} disabled={locating === 'busy'}>
                  <Icon name="map-pin" /> {locating === 'busy' ? 'Getting location…' : locating === 'ok' ? 'Location pinned ✓ (helps the rider find you)' : 'Use my current location'}
                </button>
                {locating && !['busy', 'ok'].includes(locating) && <p className="ck-locate-err">{locating}</p>}
              </div>
            )}

            <p className="ck-sub">Delivery instructions</p>
            <div className="ck-chips">
              {INSTRUCTIONS.map((t, i) => (
                <button key={t} className={`ck-chip ${instr[i] ? 'on' : ''}`} onClick={() => setInstr(s => ({ ...s, [i]: !s[i] }))}>{t}</button>
              ))}
            </div>

            {error && <p className="ck-error" role="alert">{error}</p>}
            <div className="ck-acts"><span /><button className="ck-btn" onClick={submitAddress}>Deliver here</button></div>
          </div>
        )}
      </div>

      {/* STEP 2: TIME & TIP */}
      <div className={`ck-tl ${timelineState(2)}`}>
        <div className="ck-dot">{step > 2 ? <Icon name="check" /> : 2}</div>
        <div className="ck-th">
          <div>
            <b>Delivery time</b>
            {step > 2 && <div className="ck-sum">{slotInfo.title} · {slotInfo.sub}{tip > 0 ? ` · Tip ₹${tip}` : ''}</div>}
          </div>
          {step > 2 && <button className="ck-edit" onClick={() => setStep(2)}>Edit</button>}
        </div>

        {step === 2 && (
          <div className="ck-body">
            <div className="ck-slots">
              {SLOTS.map(s => (
                <button key={s.id} className={`ck-slot ${slot === s.id ? 'on' : ''}`} onClick={() => setSlot(s.id)}>
                  <b>{s.title}</b><span>{s.sub}</span>
                </button>
              ))}
            </div>
            <p className="ck-sub">Tip your delivery partner</p>
            <div className="ck-chips">
              {TIPS.map(t => (
                <button key={t} className={`ck-chip ${tip === t ? 'on' : ''}`} onClick={() => setTip(t)}>{t ? `₹${t}` : 'No tip'}</button>
              ))}
            </div>
            <div className="ck-note">100% of the tip goes to the delivery partner.</div>
            <div className="ck-acts">
              <button className="ck-btn ghost" onClick={() => setStep(1)}>Back</button>
              <button className="ck-btn" onClick={() => setStep(3)}>Continue</button>
            </div>
          </div>
        )}
      </div>

      {/* STEP 3: PAYMENT */}
      <div className={`ck-tl ${timelineState(3)}`}>
        <div className="ck-dot">3</div>
        <div className="ck-th"><div><b>Payment</b></div></div>

        {step === 3 && (
          <div className="ck-body">
            <div className="ck-paytop">
              <span>Offers update the amount instantly</span>
              <div className="ck-payamt">
                {(methodOff > 0 || couponOff > 0) && <s>{rs(subtotal + DELIVERY + tip)}</s>}
                <b>{rs(total)}</b>
              </div>
            </div>

            {['UPI', 'Cards', 'More'].map(g => (
              <div key={g}>
                <p className="ck-group">{GROUP_TITLES[g]}</p>
                {PAY_METHODS.filter(m => m.group === g).map(m => {
                  const on = methodId === m.id
                  const { off } = methodOffer(m, base)
                  return (
                    <div key={m.id}>
                      <button className={`ck-method ${on ? 'on' : ''}`} onClick={() => { setMethodId(m.id); setError('') }}>
                        {payLogo(m.id)
                          ? <span className="ck-logo img"><img src={payLogo(m.id)} alt={m.name} /></span>
                          : <span className={`ck-logo ${m.icon ? 'em' : ''}`} style={m.color ? { background: m.color } : undefined}>{m.icon ? <Icon name={m.icon} /> : m.logo}</span>}
                        <div className="ck-method-name">
                          <b>{m.name}</b>
                          <span>{m.sub}</span>
                          {m.offer && (
                            <div>
                              <span className="ck-badge">{m.offer.label}</span>
                              {m.best && <span className="ck-badge best">Best offer</span>}
                            </div>
                          )}
                        </div>
                        <div className="ck-method-price">
                          {rs(base + tip - off)}
                          {off > 0 && <s>{rs(base + tip)}</s>}
                        </div>
                        <span className="ck-radio" />
                      </button>

                      {on && m.id === 'card' && (
                        <div className="ck-extra">
                          <div className="ck-grid">
                            <div className="full">
                              <label className="ck-lab" htmlFor="ck-cn">Card number</label>
                              <input id="ck-cn" className="ck-input" inputMode="numeric" placeholder="4242 4242 4242 4242" maxLength={19}
                                value={card.no}
                                onChange={(e) => setCard(c => ({ ...c, no: e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim() }))} />
                            </div>
                            <div className="full">
                              <label className="ck-lab" htmlFor="ck-cm">Name on card</label>
                              <input id="ck-cm" className="ck-input" placeholder="Name" value={card.name}
                                onChange={(e) => setCard(c => ({ ...c, name: e.target.value }))} />
                            </div>
                            <div>
                              <label className="ck-lab" htmlFor="ck-ce">Expiry</label>
                              <input id="ck-ce" className="ck-input" placeholder="MM/YY" maxLength={5} value={card.exp}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                                  setCard(c => ({ ...c, exp: v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v }))
                                }} />
                            </div>
                            <div>
                              <label className="ck-lab" htmlFor="ck-cv">CVV</label>
                              <input id="ck-cv" className="ck-input" type="password" inputMode="numeric" placeholder="•••" maxLength={3} value={card.cvv}
                                onChange={(e) => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, '') }))} />
                            </div>
                          </div>
                        </div>
                      )}

                      {on && m.id === 'nb' && (
                        <div className="ck-extra">
                          <div className="ck-chips">
                            {BANKS.map(b => (
                              <button key={b} className={`ck-chip ${bank === b ? 'on' : ''}`} onClick={() => setBank(b)}>{b}</button>
                            ))}
                          </div>
                        </div>
                      )}

                      {on && m.id === 'cod' && (
                        <div className="ck-extra"><div className="ck-note">Please keep exact change ready.</div></div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            <div className="ck-coupon">
              <input
                className="ck-input"
                placeholder="Coupon code"
                aria-label="Coupon code"
                value={coupon ? coupon.code : couponText}
                disabled={Boolean(coupon) || checking}
                onChange={(e) => setCouponText(e.target.value.toUpperCase())}
              />
              <button
                className="ck-btn ghost sm"
                disabled={checking}
                onClick={() => (coupon ? (setCoupon(null), setCouponText('')) : applyCoupon(couponText))}
              >{coupon ? 'Remove' : checking ? 'Checking…' : 'Apply'}</button>
            </div>
            {!coupon && offers.length > 0 && (
              <div className="ck-hintrow">
                {offers.slice(0, 3).map((o) => (
                  <button key={o.code} type="button" className="ck-badge" style={{ border: 0, cursor: 'pointer' }} onClick={() => applyCoupon(o.code)}>{o.code} · {o.title}</button>
                ))}
              </div>
            )}

            <div className="ck-bill boxed">{billRows}</div>

            {error && <p className="ck-error" role="alert">{error}</p>}

            <div className={`ck-slide ${slide > 0 ? 'drag' : ''} ${slide >= 95 ? 'done' : ''}`} style={{ '--p': slide }}>
              <div className="ck-slide-lbl">{placing ? 'Placing your order…' : isCOD ? `Slide to place order · ${rs(total)}` : `Slide to pay ${rs(total)}`} <span className="ck-chev" aria-hidden="true">›››</span></div>
              <input
                type="range" min="0" max="100" value={slide} disabled={placing}
                aria-label={isCOD ? 'Slide to place order' : 'Slide to pay'}
                onChange={(e) => setSlide(Number(e.target.value))}
                onPointerUp={() => finishSlide()}
                onKeyDown={(e) => { if (e.key === 'Enter') { setSlide(100); finishSlide(100) } }}
              />
            </div>
            <p className="ck-slide-hint">Drag the handle all the way to the right. Keyboard: focus the slider and press Enter.</p>
            <div className="ck-trust"><span><Icon name="lock" /> Encrypted</span><span><Icon name="undo" /> Easy refunds</span><span><Icon name="check" /> Fresh or free</span></div>
            <div className="ck-acts"><button className="ck-btn ghost" onClick={() => setStep(2)}>Back</button><span /></div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CheckoutPage
