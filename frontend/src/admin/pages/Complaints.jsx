import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageSquareWarning } from 'lucide-react'
import { api } from '../../shared/api/client.js'
import { resolveImage } from '../../shared/utils/images.js'
import { Empty, ErrorNote, PageHead, StatusBadge } from '../components/ui.jsx'
import { COMPLAINT_TYPES, fmtDateTime } from '../utils/format.js'

const C_STATUS = {
  open:        { label: 'Open',        tone: 'amber' },
  in_progress: { label: 'Approved', tone: 'blue' },
  resolved:    { label: 'Resolved',    tone: 'green' },
  rejected:    { label: 'Rejected',    tone: 'red' },
}
const FILTERS = [['open', 'Needs action'], ['closed', 'Closed'], ['all', 'All']]

const PAY = { gpay: 'GPay', phonepe: 'PhonePe', paytm: 'Paytm', bhim: 'BHIM', card: 'Card', nb: 'Net Banking', cod: 'Cash' }
const rs = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

// Refund / exchange request for items: Approve -> (exchange) Mark exchanged, or Reject
function ItemRequest({ c, onSaved }) {
  const ex = c.resolution === 'exchange'
  const [reply, setReply] = useState(c.response || '')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const closed = ['resolved', 'rejected'].includes(c.status)
  const to = c.refund_to === 'source' ? `${PAY[c.payment_method] || 'original payment'} (3–5 days)` : 'FreshMart Cash (instant)'

  const act = async (status, fallback) => {
    const text = reply.trim() || fallback
    if (!text) { setError('Write a short reply for the customer first.'); return }
    setBusy(true); setError('')
    try { onSaved(await api.patch(`/api/admin/complaints/${c.id}`, { status, response: text })) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="ad-card ad-complaint">
      <div className="ad-card-head">
        <div>
          <h2>{ex ? 'Exchange' : 'Refund'} · {COMPLAINT_TYPES[c.type] || c.type} · <span className="mono">#{c.order_number}</span></h2>
          <p className="ad-muted ad-small">{c.customer_name}{c.customer_phone ? ` · +91 ${c.customer_phone}` : ''} · {fmtDateTime(c.created_at)}</p>
        </div>
        <StatusBadge status={c.status} map={C_STATUS} />
      </div>
      <div className="ad-req-items">
        {(c.items || []).map((i) => (
          <div key={i.pid} className="ad-row"><span>{i.name} <span className="ad-muted">{i.unit} × {i.quantity}</span></span><b>{rs(i.amount)}</b></div>
        ))}
        <div className="ad-row"><span className="ad-muted">{ex ? 'Customer wants' : 'Refund to'}</span><b>{ex ? 'A fresh replacement (collect the old one)' : `${rs(c.amount)} → ${to}`}</b></div>
      </div>
      <p className="ad-quote">{c.description}</p>
      {c.photos?.length > 0 && (
        <div className="ad-req-photos">
          {c.photos.map((p) => <a key={p} href={resolveImage(p)} target="_blank" rel="noreferrer"><img src={resolveImage(p)} alt="Customer photo" /></a>)}
        </div>
      )}

      {closed ? (
        c.response && <p className="ad-reply"><b>Your reply:</b> {c.response}</p>
      ) : c.status === 'in_progress' ? (
        <>
          <p className="ad-reply"><b>Approved.</b> {c.exchange_order_number
            ? <>Replacement order <span className="mono">#{c.exchange_order_number}</span> went to delivery partners like a normal order. It closes by itself once the rider delivers it.</>
            : 'Send the fresh item and collect the old one, then mark it done.'}</p>
          <ErrorNote>{error}</ErrorNote>
          <div className="ad-form-actions">
            <button className="ad-btn ghost" disabled={busy} onClick={() => act('resolved', c.response)}>We delivered it ourselves</button>
          </div>
        </>
      ) : (
        <>
          <textarea className="ad-input" rows={2} placeholder={ex ? 'e.g. Sorry! A fresh one is on the way.' : 'e.g. Sorry! Refund approved.'}
            value={reply} onChange={(e) => setReply(e.target.value)} />
          <ErrorNote>{error}</ErrorNote>
          <div className="ad-form-actions">
            <button className="ad-btn ghost danger" disabled={busy} onClick={() => act('rejected', '')}>Reject</button>
            <button className="ad-btn" disabled={busy} onClick={() => act('in_progress', ex ? 'Sorry about this! A fresh one is on the way.' : 'Sorry about this! Refund approved.')}>
              {ex ? 'Approve & send a rider' : `Approve refund · ${rs(c.amount)}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function ComplaintCard({ c, onSaved }) {
  if (c.resolution) return <ItemRequest c={c} onSaved={onSaved} />
  return <SimpleComplaint c={c} onSaved={onSaved} />
}

function SimpleComplaint({ c, onSaved }) {
  const [reply, setReply] = useState(c.response || '')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const closed = ['resolved', 'rejected'].includes(c.status)
  const isReturn = c.type === 'return'

  const act = async (status) => {
    if (reply.trim().length < 2) { setError('Write a short reply for the customer first.'); return }
    setBusy(true); setError('')
    try { onSaved(await api.patch(`/api/admin/complaints/${c.id}`, { status, response: reply.trim() })) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="ad-card ad-complaint">
      <div className="ad-card-head">
        <div>
          <h2>{COMPLAINT_TYPES[c.type] || c.type} · <span className="mono">#{c.order_number}</span></h2>
          <p className="ad-muted ad-small">{c.customer_name}{c.customer_phone ? ` · +91 ${c.customer_phone}` : ''} · {fmtDateTime(c.created_at)}</p>
        </div>
        <StatusBadge status={c.status} map={C_STATUS} />
      </div>
      <p className="ad-quote">{c.description}</p>

      {closed ? (
        c.response && <p className="ad-reply"><b>Your reply:</b> {c.response}</p>
      ) : (
        <>
          <textarea className="ad-input" rows={2} placeholder={isReturn ? 'e.g. Return approved, refund in 3-5 days' : 'Reply to the customer'}
            value={reply} onChange={(e) => setReply(e.target.value)} />
          <ErrorNote>{error}</ErrorNote>
          <div className="ad-form-actions">
            {c.status === 'open' && <button className="ad-btn ghost" disabled={busy} onClick={() => act('in_progress')}>Mark in progress</button>}
            <button className="ad-btn ghost danger" disabled={busy} onClick={() => act('rejected')}>{isReturn ? 'Reject return' : 'Reject'}</button>
            <button className="ad-btn" disabled={busy} onClick={() => act('resolved')}>{isReturn ? 'Approve return & refund' : c.type === 'refund' ? 'Refund & resolve' : 'Resolve'}</button>
          </div>
        </>
      )}
    </div>
  )
}

export default function Complaints() {
  const [items, setItems]   = useState(null)
  const [error, setError]   = useState('')
  const [filter, setFilter] = useState('open')

  const load = useCallback(() => api.get('/api/admin/complaints').then(setItems).catch(e => setError(e.message)), [])
  useEffect(() => { load() }, [load])

  const list = useMemo(() => (items || []).filter(c =>
    filter === 'all' ? true : filter === 'open' ? ['open', 'in_progress'].includes(c.status) : ['resolved', 'rejected'].includes(c.status)
  ), [items, filter])

  return (
    <>
      <PageHead title="Returns & Complaints" sub="Refunds go out when you approve. Approving an exchange sends a free replacement order to delivery partners." />
      <div className="ad-tabs">
        {FILTERS.map(([id, label]) => (
          <button key={id} className={`ad-tab ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      <ErrorNote>{error}</ErrorNote>
      {!items ? <p className="ad-muted">Loading…</p> : list.length === 0 ? (
        <Empty icon={MessageSquareWarning} title="Nothing here" text="Customer returns and complaints will show up here." />
      ) : (
        <div className="ad-stack">
          {list.map(c => <ComplaintCard key={c.id} c={c} onSaved={(n) => setItems(xs => xs.map(x => x.id === n.id ? n : x))} />)}
        </div>
      )}
    </>
  )
}
