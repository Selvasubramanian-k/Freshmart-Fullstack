import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Headset, LogOut, Phone, Flag, ChevronLeft, Send, Check } from 'lucide-react'
import { useAuth } from '../shared/context/AuthContext.jsx'
import { api } from '../shared/api/client.js'
import { resolveImage } from '../shared/utils/images.js'
import './support.css'

// ─────────────────────────────────────────────────────────────
//  Support / operations inbox (/support): every store's complaints, late orders,
//  missing items from pickers, cancellations and refunds. Support team + FreshMart owner.
// ─────────────────────────────────────────────────────────────
const asDate = (iso) => new Date(/Z$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`)
const rs = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const clock = (iso) => asDate(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
const FILTERS = [['all', 'All'], ['complaint', 'Complaints'], ['late', 'Late'], ['substitution', 'Missing items'], ['refund', 'Refunds'], ['cancellation', 'Cancel']]
const TONE = { complaint: 'red', late: 'amber', substitution: 'violet', refund: 'grey', cancellation: 'blue' }
const QUICK = ['Sorry about this. Checking now.', 'Can you share a photo of the item?', 'Done! Anything else I can help with?']
const PAY = { cod: 'Cash', gpay: 'GPay', phonepe: 'PhonePe', paytm: 'Paytm', card: 'Card', nb: 'Net banking', bhim: 'BHIM', exchange: 'Exchange' }

function sla(t, now) {
  if (['resolved', 'rejected'].includes(t.status)) return ['Closed', 'grey']
  if (t.status === 'needs_approval') return ['Owner OK needed', 'violet']
  const left = Math.round((asDate(t.due_at).getTime() - now) / 60000)
  if (left < 0) return [`${-left} min over`, 'red']
  return [left >= 60 ? `${Math.round(left / 60)} h left` : `${left} min left`, left <= 3 ? 'red' : 'amber']
}

function Actions({ t, owner, run, busy }) {
  const o = t.order
  const [amount, setAmount] = useState('')
  const [to, setTo] = useState('cash')
  const [note, setNote] = useState('')
  const paidOnline = o?.payment && !['cod', 'exchange'].includes(o.payment.method)
  const left = o ? Math.max(0, (o.bill?.total || 0) - (o.refunded || 0)) : 0
  const live = o && ['placed', 'confirmed', 'packed', 'out_for_delivery'].includes(o.status)

  if (['resolved', 'rejected'].includes(t.status)) return null
  if (t.status === 'needs_approval') {
    return (
      <div className="su-sec"><h3>WAITING FOR THE OWNER</h3>
        <p className="su-small">{t.pending_refund.by} asked to refund {rs(t.pending_refund.amount)} ({t.pending_refund.to === 'cash' ? 'FreshMart wallet' : 'original payment'}).</p>
        {owner && <>
          <button className="su-btn green" disabled={busy} onClick={() => run('approve_refund')}>Approve refund</button>
          <button className="su-btn ghost" disabled={busy} onClick={() => run('reject_refund')}>Say no</button>
        </>}
      </div>
    )
  }
  return (
    <div className="su-sec"><h3>ACTIONS</h3>
      {t.type === 'substitution' && <>
        {t.substitute
          ? <button className="su-btn green" disabled={busy} onClick={() => run('substitute')}>Customer said yes: pack {t.substitute.name}</button>
          : <p className="su-small">No similar item in stock.</p>}
        <button className="su-btn ghost" disabled={busy} onClick={() => run('remove_item')}>Remove {t.missing?.name} {o?.payment?.status === 'paid' ? `+ refund ${rs(t.missing?.amount)}` : ''}</button>
      </>}
      {t.group === 'late' && o?.pickable && <button className="su-btn green" disabled={busy} onClick={() => run('assign_rider')}>Assign the nearest free rider</button>}
      {t.group === 'late' && o?.bill?.delivery_fee > 0 && <button className="su-btn ghost" disabled={busy} onClick={() => run('refund', { amount: o.bill.delivery_fee, to: 'cash' })}>Give back delivery fee ({rs(o.bill.delivery_fee)}) + sorry</button>}
      {t.amount > 0 && t.type !== 'substitution' && (
        <button className="su-btn green" disabled={busy} onClick={() => run('refund', { amount: t.amount, to: paidOnline ? 'source' : 'cash' })}>Refund {rs(t.amount)} ({paidOnline ? 'to their payment' : 'to wallet'})</button>
      )}
      {t.resolution === 'exchange' && t.status === 'open' && <button className="su-btn ghost" disabled={busy} onClick={() => run('resolve')}>Send a free replacement</button>}
      {live && <button className="su-btn ghost" disabled={busy} onClick={() => { if (window.confirm(`Cancel order #${o.number}?`)) run('cancel_order', { text: note || undefined }) }}>Cancel the order</button>}

      {t.type !== 'substitution' && left > 0 && (
        <details className="su-more">
          <summary>Other refund or wallet credit</summary>
          <label className="su-lbl" htmlFor="su-amt">Amount (up to {rs(left)})</label>
          <input id="su-amt" className="su-in" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="50" />
          <div className="su-seg" role="radiogroup" aria-label="Refund to">
            <button role="radio" aria-checked={to === 'cash'} className={to === 'cash' ? 'on' : ''} onClick={() => setTo('cash')}>FreshMart wallet</button>
            <button role="radio" aria-checked={to === 'source'} className={to === 'source' ? 'on' : ''} disabled={!paidOnline} onClick={() => setTo('source')}>Original payment</button>
          </div>
          <button className="su-btn ghost" disabled={busy || !(Number(amount) > 0)} onClick={() => run('refund', { amount: Number(amount), to })}>Refund {amount ? rs(amount) : ''}</button>
        </details>
      )}
      <label className="su-lbl" htmlFor="su-note">Note for the customer (when you close)</label>
      <input id="su-note" className="su-in" value={note} onChange={(e) => setNote(e.target.value)} placeholder="eg. We spoke to the store." />
      <div className="su-two">
        <button className="su-btn ghost" disabled={busy} onClick={() => run('resolve', { text: note || undefined })}><Check size={15} /> Solved</button>
        <button className="su-btn ghost" disabled={busy} onClick={() => run('reject', { text: note || undefined })}>Can’t accept</button>
      </div>
      <p className="su-small">Refunds above ₹500 go to the FreshMart owner to approve.</p>
    </div>
  )
}

function Detail({ id, owner, onChanged, onBack }) {
  const [t, setT] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const chatRef = useRef(null)

  useEffect(() => {
    let live = true
    api.get(`/api/support/tickets/${id}`).then((r) => live && setT(r)).catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [id])
  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight) }, [t?.messages?.length])

  const run = async (action, extra = {}) => {
    setBusy(true); setError('')
    try { const r = await api.post(`/api/support/tickets/${id}/action`, { action, ...extra }); setT(r); onChanged(r); if (action === 'reply') setText('') }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  if (!t || t.id !== id) return <section className="su-mid"><p className="su-pad su-small">{error || 'Opening…'}</p></section>
  const o = t.order
  return (
    <>
      <section className="su-mid">
        <div className="su-mh">
          <button className="su-back" onClick={onBack}><ChevronLeft size={18} /> Tickets</button>
          <div><h2>{t.title}</h2><p>{t.customer_name} · #{t.order_number} · {t.store_name}</p></div>
          <div className="su-mh-acts">
            {t.customer_phone && <a className="su-btn ghost sm" href={`tel:+91${t.customer_phone}`}><Phone size={14} /> Call</a>}
            {!['resolved', 'rejected'].includes(t.status) && (
              <button className="su-btn ghost sm" disabled={busy || t.escalated} onClick={() => run('escalate')}><Flag size={14} /> {t.escalated ? 'Escalated' : 'Escalate'}</button>
            )}
          </div>
        </div>
        <div className="su-chat" ref={chatRef}>
          {t.messages.map((m, i) => (
            <div key={i} className={`su-msg ${m.from}`}>
              {m.text}
              <small>{m.from === 'system' ? `${m.by ? `${m.by} · ` : ''}${clock(m.at)}` : `${m.from === 'support' ? m.by || 'Support' : t.customer_name} · ${clock(m.at)}`}</small>
            </div>
          ))}
          {t.photos?.length > 0 && <div className="su-photos">{t.photos.map((p) => <a key={p} href={resolveImage(p)} target="_blank" rel="noreferrer"><img src={resolveImage(p)} alt="Customer photo" /></a>)}</div>}
        </div>
        {error && <p className="su-err" role="alert">{error}</p>}
        <form className="su-reply" onSubmit={(e) => { e.preventDefault(); if (text.trim()) run('reply', { text: text.trim() }) }}>
          <div className="su-quick">{QUICK.map((q) => <button type="button" key={q} disabled={busy} onClick={() => run('reply', { text: q })}>{q}</button>)}</div>
          <div className="su-box">
            <input className="su-in" aria-label="Reply to the customer" placeholder="Type a reply to the customer (they get it by SMS and in the app)…" value={text} onChange={(e) => setText(e.target.value)} />
            <button className="su-btn" disabled={busy || !text.trim()}><Send size={15} /> Send</button>
          </div>
        </form>
      </section>
      <aside className="su-side">
        {o && (
          <div className="su-sec"><h3>ORDER #{o.number}</h3>
            {o.items.map((it, i) => <div key={i} className={`su-line ${it.problem ? 'bad' : ''}`}><span>{it.name} ×{it.quantity}</span><b>{rs(it.line_total)}</b></div>)}
            <div className="su-kv"><span>Total</span><b>{rs(o.bill?.total)}</b></div>
            <div className="su-kv"><span>Paid by</span><b>{PAY[o.payment?.method] || o.payment?.method} · {o.payment?.status}</b></div>
            {o.refunded > 0 && <div className="su-kv"><span>Refunded</span><b>{rs(o.refunded)}</b></div>}
            <div className="su-kv"><span>Status</span><b>{o.status?.replace(/_/g, ' ')}</b></div>
            <div className="su-kv"><span>Rider</span><b>{o.partner || 'Not yet'}</b></div>
          </div>
        )}
        <div className="su-sec"><h3>CUSTOMER</h3>
          <div className="su-kv"><span>Orders</span><b>{t.customer.orders}</b></div>
          <div className="su-kv"><span>Past refunds</span><b>{t.customer.refunds}</b></div>
          <div className="su-kv"><span>Wallet</span><b>{rs(t.customer.wallet)}</b></div>
        </div>
        <Actions key={t.id + t.status} t={t} owner={owner} run={run} busy={busy} />
        {['resolved', 'rejected'].includes(t.status) && <div className="su-done"><Check size={16} /> {t.status === 'resolved' ? 'Solved' : 'Closed'}. The customer got an SMS.</div>}
      </aside>
    </>
  )
}

export default function SupportApp() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [show, setShow] = useState('open')
  const [filter, setFilter] = useState('all')
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const sel = params.get('ticket')
  const owner = user?.role === 'superadmin'

  const load = useCallback(() => api.get(`/api/support/tickets?show=${show}`).then((r) => { setItems(r); setError('') }).catch((e) => setError(e.message)), [show])
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t) }, [load])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])

  const pick = (id) => setParams(id ? { ticket: id } : {}, { replace: !id })
  const onChanged = (t) => setItems((xs) => (xs || []).map((x) => (x.id === t.id ? { ...x, status: t.status, escalated: t.escalated, preview: t.preview } : x)))
  const shown = (items || []).filter((t) => filter === 'all' || t.group === filter)
  const count = (g) => (items || []).filter((t) => g === 'all' || t.group === g).length

  return (
    <div className={`su ${sel ? 'has-sel' : ''}`}>
      <section className="su-list">
        <div className="su-lh">
          <div className="su-lh-top">
            <span className="su-mark" aria-hidden="true"><Headset size={19} /></span>
            <div><b>Support inbox</b><small>{user?.name} · all stores</small></div>
            {owner ? <Link className="su-link" to="/owner">Owner panel</Link>
              : <button className="su-link" onClick={() => { logout(); navigate('/login') }}><LogOut size={14} /> Log out</button>}
          </div>
          <div className="su-seg" role="tablist" aria-label="Show">
            <button role="tab" aria-selected={show === 'open'} className={show === 'open' ? 'on' : ''} onClick={() => { setShow('open'); setItems(null) }}>Open</button>
            <button role="tab" aria-selected={show === 'solved'} className={show === 'solved' ? 'on' : ''} onClick={() => { setShow('solved'); setItems(null) }}>Solved (3 days)</button>
          </div>
          <div className="su-flt">{FILTERS.map(([k, label]) => (
            <button key={k} className={filter === k ? 'on' : ''} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label} {items ? count(k) : ''}</button>
          ))}</div>
        </div>
        <div className="su-tks">
          {error && <p className="su-err" role="alert">{error}</p>}
          {!items ? <p className="su-pad su-small">Loading…</p> : shown.length === 0 && <p className="su-pad su-small">{show === 'open' ? 'No open tickets. Nice!' : 'Nothing solved in the last 3 days.'}</p>}
          {shown.map((t) => {
            const [label, tone] = sla(t, now)
            return (
              <button key={t.id} className={`su-tk ${sel === t.id ? 'on' : ''}`} onClick={() => pick(t.id)}>
                <span className="su-tk-top"><b>{t.title}</b><span className={`su-badge ${tone}`}>{label}</span></span>
                <span className="su-small">{t.customer_name} · {t.store_name} · #{t.order_number}</span>
                <span className="su-small su-prev">{t.preview}</span>
                <span className="su-tags"><span className={`su-badge ${TONE[t.group] || 'grey'}`}>{FILTERS.find(([k]) => k === t.group)?.[1] || t.group}</span>
                  {t.escalated && <span className="su-badge red">Escalated</span>}{t.auto && <span className="su-badge grey">Auto</span>}</span>
              </button>
            )
          })}
        </div>
      </section>
      {sel ? <Detail id={sel} owner={owner} onChanged={onChanged} onBack={() => pick(null)} />
        : <section className="su-mid su-none"><Headset size={36} /><b>Pick a ticket</b><span>The oldest one is at the top. Red means it’s late.</span></section>}
    </div>
  )
}
