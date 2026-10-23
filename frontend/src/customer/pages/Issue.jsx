// Report a problem with a delivered order AND follow it, on one timeline:
//   1 items  2 what went wrong  3 refund or exchange   (customer fills these)
//   4 store reviewing  5 approved  6 money back / new item delivered   (store moves these)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Camera, Check, MessageCircle, Minus, Plus, Repeat, RotateCcw, X } from 'lucide-react'
import { api } from '../../shared/api/client.js'
import { resolveImage } from '../../shared/utils/images.js'
import { getProduct } from '../data/products.js'
import ProductImage from '../components/ProductImage.jsx'

const REASONS = [
  ['damaged', 'Damaged / leaking'], ['missing_item', 'Missing'], ['wrong_item', 'Wrong item'],
  ['quality', 'Not fresh'], ['expired', 'Expired'],
]
const REASON_LABEL = Object.fromEntries(REASONS)
const PAY_NAMES = { gpay: 'GPay', phonepe: 'PhonePe', paytm: 'Paytm', bhim: 'BHIM', card: 'Card', nb: 'Net Banking', cod: 'Cash' }
const OPEN = ['open', 'in_progress']

const rs = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const toDate = (iso) => new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z')
const fmtTime = (iso) => {
  if (!iso) return ''
  const d = toDate(iso)
  const day = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return `${day}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}`
}
const imgOf = (it) => getProduct(it.pid)?.img || resolveImage(it.image_url)

export default function Issue() {
  const { orderId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const [order, setOrder] = useState(null)
  const [req, setReq] = useState(null)        // the request once it is sent
  const [error, setError] = useState('')

  // form
  const [step, setStep] = useState(1)
  const [sel, setSel] = useState({})          // pid -> qty
  const [reason, setReason] = useState('damaged')
  const [text, setText] = useState('')
  const [photos, setPhotos] = useState([])    // '/uploads/..'
  const [fix, setFix] = useState('refund')
  const [dest, setDest] = useState('cash')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const [o, list] = await Promise.all([api.get(`/api/customer/orders/${orderId}`), api.get('/api/customer/complaints')])
      setOrder(o)
      const wanted = params.get('c')
      const mine = list.filter((c) => c.order_id === orderId && c.resolution)
      setReq(wanted ? mine.find((c) => c.id === wanted) || null : mine.find((c) => c.status !== 'cancelled') || null)
      setError('')
    } catch (e) { setError(e.message) }
  }, [orderId, params])
  useEffect(() => { load() }, [load])

  // the store answers from its side: keep the timeline fresh while the request is open
  const live = req && OPEN.includes(req.status)
  useEffect(() => {
    if (!live) return
    const t = setInterval(load, 8000)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [live, load])

  const cod = order?.payment?.method === 'cod'
  const dests = cod
    ? [{ id: 'cash', label: 'FreshMart Cash · instant' }]
    : [{ id: 'cash', label: 'FreshMart Cash · instant' }, { id: 'source', label: `${PAY_NAMES[order?.payment?.method] || 'Original payment'} · 3–5 days` }]

  const chosen = useMemo(() => (order?.items || []).filter((i) => sel[i.pid]).map((i) => ({ ...i, qty: sel[i.pid] })), [order, sel])
  const amount = chosen.reduce((a, i) => a + (i.line_total / i.quantity) * i.qty, 0)

  // ---------- actions ----------
  const toggle = (it) => setSel((s) => { const n = { ...s }; if (n[it.pid]) delete n[it.pid]; else n[it.pid] = it.quantity; return n })
  const setQty = (it, d) => setSel((s) => ({ ...s, [it.pid]: Math.min(it.quantity, Math.max(1, (s[it.pid] || 1) + d)) }))

  const addPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true); setMsg('')
    try { const r = await api.upload('/api/customer/uploads', file); setPhotos((p) => [...p, r.image_url].slice(0, 3)) }
    catch (err) { setMsg(err.message) } finally { setBusy(false) }
  }

  const send = async () => {
    setBusy(true); setMsg('')
    const names = chosen.map((i) => i.name).join(', ')
    const description = text.trim().length >= 5 ? text.trim() : `${REASON_LABEL[reason]}: ${names}`
    try {
      const c = await api.post('/api/customer/complaints', {
        order_id: orderId, type: reason, description,
        items: chosen.map((i) => ({ pid: i.pid, quantity: i.qty })),
        resolution: fix, refund_to: fix === 'refund' ? dest : 'cash', photos,
      })
      setReq(c)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) { setMsg(err.message) } finally { setBusy(false) }
  }

  const cancelReq = async () => {
    if (!window.confirm('Cancel this request?')) return
    setBusy(true)
    try { setReq(await api.post(`/api/customer/complaints/${req.id}/cancel`)) } catch (err) { setMsg(err.message) } finally { setBusy(false) }
  }

  const next = () => {
    if (step === 1 && !chosen.length) return
    if (step < 3) setStep(step + 1)
    else send()
  }

  if (error && !order) {
    return <div className="is-page"><div className="is-wrap"><p className="is-msg">{error}</p><button className="is-btn ghost" onClick={() => navigate('/account')}>Back to my orders</button></div></div>
  }
  if (!order) return <div className="is-page"><div className="is-wrap"><p className="is-muted">Loading…</p></div></div>

  const sent = !!req
  if (!sent && order.status !== 'delivered') {
    return (
      <div className="is-page"><div className="is-wrap">
        <Head order={order} title="Report an issue" onBack={() => navigate(-1)} />
        <section className="is-hero"><span className="is-kick">NOT DELIVERED YET</span><h1>You can ask for a refund or exchange once the order is delivered</h1></section>
        <button className="is-btn ghost" onClick={() => navigate(`/track/${order.id}`)}>Track this order</button>
      </div></div>
    )
  }

  // ---------- what the timeline shows ----------
  const ex = (sent ? req.resolution : fix) === 'exchange'
  const H = Object.fromEntries((req?.history || []).map((h) => [h.status, h]))
  const st = req?.status
  const reqItems = sent ? req.items : chosen.map((i) => ({ ...i, quantity: i.qty, amount: (i.line_total / i.quantity) * i.qty }))
  const reqAmount = sent ? req.amount : amount
  const destLabel = sent
    ? (req.refund_to === 'source' ? `${PAY_NAMES[req.payment_method] || 'original payment'}` : 'FreshMart Cash')
    : (dest === 'source' ? PAY_NAMES[order.payment.method] : 'FreshMart Cash')
  const cur = !sent ? step - 1 : st === 'open' ? 3 : st === 'in_progress' ? 5 : 6
  const bad = st === 'rejected' || st === 'cancelled'

  const steps = [
    { title: 'Items with a problem', note: reqItems.length ? reqItems.map((i) => `${i.name}${i.quantity > 1 ? ` × ${i.quantity}` : ''}`).join(', ') + ` · ${rs(reqAmount)}` : 'Pick one or more' },
    { title: 'What went wrong', note: `${REASON_LABEL[sent ? req.type : reason] || 'Problem'}${(sent ? req.photos : photos)?.length ? ` · ${(sent ? req.photos : photos).length} photo${(sent ? req.photos : photos).length > 1 ? 's' : ''}` : ''}` },
    { title: 'Refund or exchange', note: ex ? 'Exchange · fresh item, free' : `Refund to ${destLabel}` },
    { title: st === 'cancelled' ? 'Cancelled by you' : 'Store reviewing',
      note: st === 'cancelled' ? fmtTime(req.updated_at) : st === 'open' ? 'Now · usually under 2 hours' : H.approved || H.rejected ? `Checked ${fmtTime((H.approved || H.rejected).at)}` : 'Usually under 2 hours' },
    { title: st === 'rejected' ? 'Not approved' : ex ? 'Exchange approved' : 'Refund approved',
      note: H.approved ? fmtTime(H.approved.at) : H.rejected ? fmtTime(H.rejected.at) : 'You will see it here' },
    { title: ex ? 'New item delivered' : 'Money back',
      note: H.resolved ? `${H.resolved.note} · ${fmtTime(H.resolved.at)}` : ex ? 'Rider brings a fresh one and collects the old item' : (sent ? req.refund_to : dest) === 'source' ? `Back to ${destLabel} in 3–5 working days` : 'Added to FreshMart Cash right after approval' },
  ].slice(0, st === 'cancelled' ? 4 : st === 'rejected' ? 5 : 6)

  const hero = !sent
    ? { tone: 'form', k: 'REPORT AN ISSUE', t: 'Tell us what went wrong', s: 'Three quick steps. We will sort it out fast.', lbl: 'item value' }
    : st === 'open' ? { tone: 'wait', k: 'UNDER REVIEW', t: 'The store is checking it', s: 'Most requests are answered within 2 hours.', lbl: ex ? 'item value' : 'if approved' }
    : st === 'in_progress' ? { tone: 'ok', k: 'EXCHANGE APPROVED', t: 'A fresh one is coming', s: 'Our rider brings the new item and collects the old one.', lbl: 'exchange' }
    : st === 'resolved' ? (ex
      ? { tone: 'done', k: 'EXCHANGED', t: 'Fresh item delivered', s: 'Sorry about that, and thanks for telling us.', lbl: 'exchanged' }
      : { tone: 'done', k: 'REFUNDED', t: `${rs(reqAmount)} is back`, s: req.refund_to === 'source' ? `Refund sent to ${destLabel}. It shows in 3–5 working days.` : 'Added to your FreshMart Cash. Use it on your next order.', lbl: 'refunded' })
    : st === 'rejected' ? { tone: 'bad', k: 'NOT APPROVED', t: 'We could not approve this', s: 'See the store’s reply below. Chat with us if you disagree.', lbl: 'not refunded' }
    : { tone: 'off', k: 'CANCELLED', t: 'You cancelled this request', s: 'You can raise a new one from this order.', lbl: '' }

  const doneUpTo = st === 'resolved' ? 6 : cur
  return (
    <div className="is-page">
      <div className="is-wrap">
        <Head order={order} title={sent ? 'Your request' : 'Report an issue'} onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/account'))} />

        <section className={`is-hero ${hero.tone}`} aria-live="polite">
          <div className="is-hero-row">
            <div>
              <span className="is-kick">{hero.k}</span>
              <h1>{hero.t}</h1>
              <p>{hero.s}</p>
            </div>
            {reqAmount > 0 && hero.lbl && <div className="is-amt"><b>{rs(reqAmount)}</b><span>{hero.lbl}</span></div>}
          </div>
          <div className="is-bars" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={i < doneUpTo ? 'on' : i === cur && !bad ? 'now' : ''} />)}
          </div>
        </section>

        <section className="is-card is-steps">
          {steps.map((s, i) => {
            const done = i < doneUpTo && !(bad && i === steps.length - 1)
            const active = i === cur && !sent
            const now = i === cur && sent && OPEN.includes(st)
            const isBad = bad && i === steps.length - 1
            return (
              <div key={i} className={`is-step ${done ? 'done' : ''} ${active || now ? 'now' : ''} ${isBad ? 'bad' : ''}`}>
                <div className="is-rail">
                  <span className="is-dot">{isBad ? <X size={13} strokeWidth={3.4} /> : done ? <Check size={13} strokeWidth={3.6} /> : i + 1}</span>
                  {i < steps.length - 1 && <i />}
                </div>
                <div className="is-body">
                  <div className="is-step-head">
                    <b>{s.title}</b>
                    {!sent && done && <button type="button" className="is-edit" onClick={() => setStep(i + 1)}>Edit</button>}
                  </div>
                  {!(active && i > 0) && <span className="is-note">{s.note}</span>}

                  {active && i === 0 && (
                    <div className="is-list">
                      {order.items.map((it) => {
                        const on = !!sel[it.pid]
                        return (
                          <div key={it.pid} className={`is-item ${on ? 'on' : ''}`}>
                            <button type="button" className="is-item-main" onClick={() => toggle(it)} aria-pressed={on}>
                              <span className="is-thumb"><ProductImage product={{ name: it.name, img: imgOf(it) }} /></span>
                              <span className="is-item-txt"><b>{it.name}</b><small>{it.unit} · {rs(it.line_total / it.quantity)}{it.quantity > 1 ? ` · bought ${it.quantity}` : ''}</small></span>
                              <span className="is-check">{on && <Check size={14} strokeWidth={3.4} />}</span>
                            </button>
                            {on && it.quantity > 1 && (
                              <div className="is-qty">
                                <span>How many?</span>
                                <button type="button" aria-label="Fewer" onClick={() => setQty(it, -1)}><Minus size={16} /></button>
                                <b>{sel[it.pid]}</b>
                                <button type="button" aria-label="More" onClick={() => setQty(it, 1)}><Plus size={16} /></button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {active && i === 1 && (
                    <div className="is-list">
                      <div className="is-chips">
                        {REASONS.map(([id, label]) => (
                          <button key={id} type="button" className={`is-chip ${reason === id ? 'on' : ''}`} aria-pressed={reason === id} onClick={() => setReason(id)}>{label}</button>
                        ))}
                      </div>
                      <label className="is-label" htmlFor="is-text">Tell us more <span>(optional)</span></label>
                      <textarea id="is-text" className="is-input" rows={2} maxLength={1000} value={text}
                        placeholder="e.g. The packet was torn and leaking" onChange={(e) => setText(e.target.value)} />
                      <span className="is-label">Photos <span>(helps us approve faster)</span></span>
                      <div className="is-photos">
                        {photos.map((p) => (
                          <span key={p} className="is-photo">
                            <img src={resolveImage(p)} alt="Your photo of the problem" />
                            <button type="button" aria-label="Remove photo" onClick={() => setPhotos((xs) => xs.filter((x) => x !== p))}><X size={14} /></button>
                          </span>
                        ))}
                        {photos.length < 3 && (
                          <button type="button" className="is-add-photo" disabled={busy} onClick={() => fileRef.current?.click()}>
                            <Camera size={22} /><span>{busy ? 'Uploading…' : 'Add'}</span>
                          </button>
                        )}
                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={addPhoto} />
                      </div>
                    </div>
                  )}

                  {active && i === 2 && (
                    <div className="is-list">
                      <div className="is-fix">
                        <button type="button" className={fix === 'refund' ? 'on' : ''} aria-pressed={fix === 'refund'} onClick={() => setFix('refund')}>
                          <span className="is-fix-ic"><RotateCcw size={22} /></span><b>Refund</b><small>Get your money back</small>
                        </button>
                        <button type="button" className={fix === 'exchange' ? 'on' : ''} aria-pressed={fix === 'exchange'} onClick={() => setFix('exchange')}>
                          <span className="is-fix-ic"><Repeat size={22} /></span><b>Exchange</b><small>Get a fresh one, free</small>
                        </button>
                      </div>
                      {fix === 'refund' ? (
                        <>
                          <span className="is-label">Refund to</span>
                          <div className="is-chips">
                            {dests.map((d) => (
                              <button key={d.id} type="button" className={`is-chip ${dest === d.id ? 'on' : ''}`} aria-pressed={dest === d.id} onClick={() => setDest(d.id)}>{d.label}</button>
                            ))}
                          </div>
                          {cod && <span className="is-note">Cash orders are refunded to FreshMart Cash.</span>}
                        </>
                      ) : (
                        <p className="is-info">Our rider brings a fresh one and takes the old item back. No extra charge.</p>
                      )}
                    </div>
                  )}

                  {i === 4 && sent && req.response && (H.approved || H.rejected) && (
                    <p className="is-reply"><b>{order.store_name}:</b> {req.response}</p>
                  )}
                </div>
              </div>
            )
          })}
        </section>

        {msg && <p className="is-msg">{msg}</p>}

        <div className="is-bar">
          {!sent ? (
            <button type="button" className="is-btn" disabled={busy || (step === 1 && !chosen.length)} onClick={next}>
              {step === 1 && !chosen.length ? 'Pick an item' : step < 3 ? 'Continue' : busy ? 'Sending…' : ex ? 'Send exchange request' : `Send refund request · ${rs(amount)}`}
            </button>
          ) : (
            <>
              <button type="button" className="is-btn ghost" onClick={() => navigate('/contact')}><MessageCircle size={18} /> Chat with us</button>
              {st === 'open' && <button type="button" className="is-btn ghost danger" disabled={busy} onClick={cancelReq}>Cancel request</button>}
              {st === 'cancelled' && <button type="button" className="is-btn" onClick={() => { setReq(null); setStep(1); setSel({}); setPhotos([]); setText('') }}>Report again</button>}
              {['resolved', 'rejected'].includes(st) && <button type="button" className="is-btn" onClick={() => navigate('/')}>Continue shopping</button>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Head({ order, title, onBack }) {
  return (
    <div className="is-head">
      <button type="button" className="is-back" aria-label="Back" onClick={onBack}><ArrowLeft size={20} /></button>
      <div>
        <b>{title}</b>
        <span>#{order.order_number} · {order.store_name}</span>
      </div>
    </div>
  )
}
