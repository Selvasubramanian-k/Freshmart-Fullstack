import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X, ChevronLeft, LogOut, MapPin, AlertTriangle, Snowflake, PackageCheck, Clock } from 'lucide-react'
import { useAuth } from '../shared/context/AuthContext.jsx'
import { api } from '../shared/api/client.js'
import { resolveImage } from '../shared/utils/images.js'
import './picker.css'

// ─────────────────────────────────────────────────────────────
//  Picker / packing staff app (/picker). Store admin adds them in Staff (role Picker or Packer).
//  Queue -> Start picking -> each item: Picked / Not on the shelf (support asks the customer)
//  -> Pack (bags + checks) -> Ready for pickup (bag tag B-07, rider sees "packed")
// ─────────────────────────────────────────────────────────────
const asDate = (iso) => new Date(/Z$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`)
const mins = (iso) => Math.max(0, Math.floor((Date.now() - asDate(iso).getTime()) / 60000))
const PAY = { cod: 'Cash', gpay: 'GPay', phonepe: 'PhonePe', paytm: 'Paytm', card: 'Card', nb: 'Net banking', bhim: 'BHIM', exchange: 'Exchange' }
const CHECKS = ['Bill slip inside', 'Bags sealed']

const RANGES = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Last 7 days']]
const STATUS = { packed: ['Waiting for rider', 'am'], out_for_delivery: ['Out for delivery', 'bl'], delivered: ['Delivered', 'g'], cancelled: ['Cancelled', 'red'], returned: ['Returned', 'red'] }

function History({ me }) {
  const [range, setRange] = useState('today')
  const [who, setWho] = useState('all')
  const [state, setState] = useState({ key: '', data: null, error: '' })
  const key = `${range}-${who}`
  useEffect(() => {
    let live = true
    api.get(`/api/picker/history?range=${range}&who=${who}&tz=${-new Date().getTimezoneOffset()}`)
      .then((data) => live && setState({ key, data, error: '' })).catch((e) => live && setState({ key, data: null, error: e.message }))
    return () => { live = false }
  }, [range, who, key])
  const h = state.key === key ? state.data : null
  const max = Math.max(1, ...(h?.board || []).map((b) => b.orders))
  const label = RANGES.find(([k]) => k === range)[1]
  return (
    <div className="pk-body">
      <div className="pk-range">{RANGES.map(([k, l]) => <button key={k} className={range === k ? 'on' : ''} aria-pressed={range === k} onClick={() => setRange(k)}>{l}</button>)}</div>
      <div className="pk-seg" role="tablist" aria-label="Whose orders">
        <button role="tab" aria-selected={who === 'me'} className={who === 'me' ? 'on' : ''} onClick={() => setWho('me')}>Only me</button>
        <button role="tab" aria-selected={who === 'all'} className={who === 'all' ? 'on' : ''} onClick={() => setWho('all')}>Everyone in store</button>
      </div>
      {state.error && <p className="pk-err" role="alert">{state.error}</p>}
      {!h ? <p className="pk-hint">Loading…</p> : <>
        <div className="pk-stats">
          <div><b>{h.orders}</b><span>Orders packed</span></div>
          <div><b>{h.items}</b><span>Items picked</span></div>
          <div><b>{h.avg_minutes == null ? '—' : h.avg_minutes < 1 ? '<1 min' : `${Math.round(h.avg_minutes)} min`}</b><span>Avg. time</span></div>
        </div>
        {who === 'all' && h.board.length > 0 && (
          <section className="pk-board"><b>Who picked</b>
            {h.board.map((p) => (
              <div key={p.name} className="pk-bp">
                <span className="pk-av" aria-hidden="true">{p.name.charAt(0)}</span>
                <div><span>{p.name}{p.name === me?.name ? ' (you)' : ''}</span><i><b style={{ width: `${(p.orders / max) * 100}%` }} /></i></div>
                <strong>{p.orders}</strong>
              </div>
            ))}
          </section>
        )}
        <p className="pk-lbl2">{label} · {h.list.length} order{h.list.length === 1 ? '' : 's'}</p>
        {h.list.length === 0 && <p className="pk-hint">Nothing packed {range === 'today' ? 'yet today' : 'in this time'}.</p>}
        {h.list.map((o) => {
          const [st, tone] = STATUS[o.status] || [o.status, 'am']
          return (
            <section key={o.id} className="pk-hrow">
              <span className="pk-htag">{o.bag_tag || '—'}</span>
              <div><b>#{o.order_number.slice(-6)} · {o.items} items{o.bags ? ` · ${o.bags} bag${o.bags > 1 ? 's' : ''}` : ''}</b>
                <span>Picked by {o.mine ? 'you' : o.picked_by} · {new Date(/Z$|[+-]\d\d:\d\d$/.test(o.packed_at) ? o.packed_at : `${o.packed_at}Z`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}{range === 'week' ? ` · ${new Date(/Z$|[+-]\d\d:\d\d$/.test(o.packed_at) ? o.packed_at : `${o.packed_at}Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}</span></div>
              <span className={`pk-st ${tone}`}>{st}</span>
            </section>
          )
        })}
      </>}
    </div>
  )
}

function Queue({ me, onOpen }) {
  const [tab, setTab] = useState('pick')
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(() => api.get('/api/picker/queue').then((q) => { setItems(q); setError('') }).catch((e) => setError(e.message)), [])
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [load])
  return (
    <>
      <div className="pk-top">
        <div className="pk-row"><div><b>{me?.store?.name || 'Your store'}</b><small>Picker · {me?.name}</small></div>
          <span className="pk-pill">{me?.packed_today ?? 0} packed today</span></div>
        <div className="pk-tabs" role="tablist" aria-label="Picker">
          <button role="tab" aria-selected={tab === 'pick'} className={tab === 'pick' ? 'on' : ''} onClick={() => setTab('pick')}>To pick{items?.length ? <em>{items.length}</em> : null}</button>
          <button role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>Picked history</button>
        </div>
      </div>
      {tab === 'history' ? <History me={me} /> : <div className="pk-body">
        {error && <p className="pk-err" role="alert">{error}</p>}
        {items && items.length === 0 && <div className="pk-empty"><PackageCheck size={40} /><b>All caught up</b><span>New orders show up here by themselves.</span></div>}
        {items?.map((o, i) => {
          const m = mins(o.created_at)
          return (
            <section key={o.id} className={`pk-ord ${i === 0 ? 'first' : ''}`}>
              <div className="pk-row"><b>#{o.order_number}</b><span className={`pk-time ${m >= 5 ? 'late' : ''}`}><Clock size={13} /> {m} min ago</span></div>
              <span>{o.items_count} items · {o.customer_name || 'Customer'} · {PAY[o.payment] || o.payment}</span>
              {o.picker && !o.mine && <span className="pk-note">{o.picker} is picking this ({o.picked}/{o.lines})</span>}
              {(!o.picker || o.mine) && (
                <button className="pk-btn" onClick={() => onOpen(o.id, !o.mine)}>{o.mine ? `Continue (${o.picked}/${o.lines} picked)` : 'Start picking'}</button>
              )}
            </section>
          )
        })}
        <p className="pk-hint">Oldest order on top. Pick it first.</p>
      </div>}
    </>
  )
}

function ItemRow({ it, onPick, onMissing, busy }) {
  const st = it.status
  const waiting = st === 'missing'
  return (
    <section className={`pk-item ${st === 'picked' || st === 'substituted' ? 'done' : waiting ? 'miss' : ''}`}>
      <div className="pk-item-top">
        <span className="pk-ph">{resolveImage(it.image_url) ? <img src={resolveImage(it.image_url)} alt="" /> : it.name.charAt(0)}</span>
        <div className="pk-it">
          <span className="pk-aisle"><MapPin size={11} /> {it.location}</span>
          <b>{it.name}</b>
          <span>{it.unit}{it.substituted_for && ` · instead of ${it.substituted_for}`}</span>
        </div>
        <span className="pk-qty">×{it.quantity}</span>
      </div>
      {it.expiry_warning && !st && <p className="pk-warn"><AlertTriangle size={14} /> Stock expires {it.expiry_date}. Take a newer pack from the back.</p>}
      {waiting && (
        <p className="pk-wait">
          {it.ticket?.status === 'resolved' || it.ticket?.status === 'rejected'
            ? it.ticket.answer
            : <>Waiting for support to ask the customer{it.ticket?.substitute ? <> about <b>{it.ticket.substitute}</b></> : ''}…</>}
        </p>
      )}
      {!st && (
        <div className="pk-acts">
          <button className="pk-btn green" disabled={busy} onClick={onPick}><Check size={18} /> Picked {it.quantity}</button>
          <button className="pk-btn line" disabled={busy} onClick={onMissing}><X size={16} /> Not on the shelf</button>
        </div>
      )}
      {(st === 'picked' || st === 'substituted') && <p className="pk-ok"><Check size={14} /> {st === 'substituted' ? 'Customer said yes. Pack this one.' : 'Picked'}</p>}
    </section>
  )
}

function Picking({ orderId, start, onBack }) {
  const [o, setO] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('pick')
  const [bags, setBags] = useState(1)
  const [checks, setChecks] = useState({})

  const load = useCallback(() => api.get(`/api/picker/orders/${orderId}`).then(setO).catch((e) => setError(e.message)), [orderId])
  useEffect(() => {
    (start ? api.post(`/api/picker/orders/${orderId}/start`) : api.get(`/api/picker/orders/${orderId}`)).then(setO).catch((e) => setError(e.message))
  }, [orderId, start])
  const waiting = o?.items.some((i) => i.status === 'missing')
  useEffect(() => { if (!waiting) return undefined; const t = setInterval(load, 6000); return () => clearInterval(t) }, [waiting, load])

  const mark = async (it, status) => {
    if (status === 'missing' && !window.confirm(`${it.name} is not on the shelf? Support will ask the customer.`)) return
    setBusy(true); setError('')
    try { setO(await api.post(`/api/picker/orders/${orderId}/item`, { index: it.index, status })) } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const pack = async () => {
    setBusy(true); setError('')
    try { setO(await api.post(`/api/picker/orders/${orderId}/pack`, { bags })); setStep('done') } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  if (!o) return <div className="pk-body">{error ? <><p className="pk-err" role="alert">{error}</p><button className="pk-btn line" onClick={onBack}>Back to orders</button></> : <p className="pk-hint">Opening…</p>}</div>
  const done = o.items.filter((i) => i.status === 'picked' || i.status === 'substituted').length
  const next = o.items.find((i) => !i.status)
  const allDone = done === o.items.length
  const checkList = o.cold ? ['Cold items in the cold bag', ...CHECKS] : CHECKS
  const checksOk = checkList.every((c) => checks[c])

  if (step === 'done' || o.status === 'packed') {
    return (
      <>
        <div className="pk-top"><h1>#{o.order_number} is ready</h1></div>
        <div className="pk-ready">
          <span className="pk-ready-ic"><Check size={46} /></span>
          <h2>Ready for pickup</h2>
          <p>Write this on every bag and keep them on the pickup shelf. The rider sees the order is packed.</p>
          <span className="pk-tag">{o.bag_tag}</span>
          <p>{o.bags} bag{o.bags > 1 ? 's' : ''} · {o.customer_name || 'Customer'}</p>
        </div>
        <div className="pk-foot"><button className="pk-btn" onClick={onBack}>Next order</button></div>
      </>
    )
  }

  return (
    <>
      <div className="pk-top">
        <div className="pk-row"><button className="pk-back" onClick={onBack}><ChevronLeft size={18} /> Orders</button><span className="pk-pill">{PAY[o.payment] || o.payment}</span></div>
        <h1>#{o.order_number} · {o.customer_name || 'Customer'}</h1>
        <div className="pk-prog" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={o.items.length} aria-label="Items picked"><span style={{ width: `${(done / o.items.length) * 100}%` }} /></div>
        <small>{done} of {o.items.length} picked · sorted shelf by shelf</small>
      </div>
      {step === 'pick' ? (
        <>
          <div className="pk-body">
            {error && <p className="pk-err" role="alert">{error}</p>}
            {o.instructions?.length > 0 && <p className="pk-note">Customer note: {o.instructions.join(' · ')}</p>}
            {o.items.map((it) => <ItemRow key={it.index} it={it} busy={busy} onPick={() => mark(it, 'picked')} onMissing={() => mark(it, 'missing')} />)}
          </div>
          <div className="pk-foot">
            {allDone ? <button className="pk-btn green" onClick={() => setStep('pack')}>All picked. Pack the order</button>
              : next ? <p className="pk-hint">Next: <b>{next.name}</b> · {next.location}</p>
                : <p className="pk-hint">Waiting for support on {o.items.filter((i) => i.status === 'missing').length} item(s)…</p>}
          </div>
        </>
      ) : (
        <>
          <div className="pk-body">
            {error && <p className="pk-err" role="alert">{error}</p>}
            <b className="pk-lbl">How many bags?</b>
            <div className="pk-bags">{[1, 2, 3, 4].map((n) => <button key={n} className={bags === n ? 'on' : ''} aria-pressed={bags === n} onClick={() => setBags(n)}>{n}</button>)}</div>
            <b className="pk-lbl">Before you seal</b>
            {checkList.map((c) => (
              <button key={c} className={`pk-chk ${checks[c] ? 'on' : ''}`} aria-pressed={Boolean(checks[c])} onClick={() => setChecks((s) => ({ ...s, [c]: !s[c] }))}>
                <span aria-hidden="true"><Check size={14} /></span>{c}{c.startsWith('Cold') && <Snowflake size={15} style={{ marginLeft: 'auto' }} />}
              </button>
            ))}
          </div>
          <div className="pk-foot">
            <button className="pk-btn green" disabled={!checksOk || busy} onClick={pack}>{busy ? 'Saving…' : 'Mark ready for pickup'}</button>
            <button className="pk-btn line" onClick={() => setStep('pick')}>Back to items</button>
          </div>
        </>
      )}
    </>
  )
}

export default function PickerApp() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [me, setMe] = useState(null)
  const [open, setOpen] = useState(null)   // { id, start }
  const [error, setError] = useState('')
  useEffect(() => { api.get('/api/picker/me').then(setMe).catch((e) => setError(e.message)) }, [open])

  return (
    <div className="pk">
      <div className="pk-shell">
        {error ? <div className="pk-body"><p className="pk-err" role="alert">{error}</p></div>
          : open ? <Picking orderId={open.id} start={open.start} onBack={() => setOpen(null)} />
            : <Queue me={me} onOpen={(id, start) => setOpen({ id, start })} />}
        {!open && <button className="pk-logout" onClick={() => { logout(); navigate('/login') }}><LogOut size={15} /> Log out</button>}
      </div>
    </div>
  )
}
