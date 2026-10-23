// Orders -> ippo backend la save aagudhu (MongoDB). Device maathinaalum history irukkum.
// Recommendation code (recommend.js) pazhaya shape use pannudhu: { id, date, items: [[productId, qty], ...] }
// So backend order ah andha shape ku map pannrom, full order `raw` la irukkum.
import { api } from '../../shared/api/client.js'

export const toHistoryOrder = (o) => ({
  id:    o.id,
  date:  o.created_at,
  items: o.items.map(i => [i.pid, i.quantity]),
  raw:   o,
})

export async function loadOrders() {
  const list = await api.get('/api/customer/orders')
  // recommend.js expects oldest -> newest
  return list.map(toHistoryOrder).reverse()
}

export async function placeOrder(payload) {
  return api.post('/api/customer/orders', payload)
}

export async function cancelOrder(orderId, reason) {
  return api.post(`/api/customer/orders/${orderId}/cancel`, { reason: reason || null })
}

export async function raiseComplaint(orderId, type, description) {
  return api.post('/api/customer/complaints', { order_id: orderId, type, description })
}

export async function loadComplaints() {
  return api.get('/api/customer/complaints')
}

export async function loadWallet() {
  return api.get('/api/customer/wallet')
}

// One line about a refund / exchange request, used on the order card and in Support.
const PAY = { gpay: 'GPay', phonepe: 'PhonePe', paytm: 'Paytm', bhim: 'BHIM', card: 'Card', nb: 'Net Banking' }
const REASON = { damaged: 'Damaged', missing_item: 'Missing item', wrong_item: 'Wrong item', quality: 'Not fresh', expired: 'Expired' }
export function requestSummary(c) {
  const amt = `₹${Number(c.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
  const ex = c.resolution === 'exchange'
  const where = c.refund_to === 'source' ? (PAY[c.payment_method] || 'your payment') : 'FreshMart Cash'
  const items = (c.items || []).map((i) => i.name).join(', ')
  const base = { sub: `${REASON[c.type] || 'Issue'} · ${items}`, kind: ex ? 'Exchange' : 'Refund' }
  switch (c.status) {
    case 'open':        return { ...base, tone: 'wait', pill: 'UNDER REVIEW', title: `${ex ? 'Exchange' : 'Refund'} under review · ${amt}`, next: 'Store replies, usually within 2 hours' }
    case 'in_progress': return { ...base, tone: 'ok', pill: 'APPROVED', title: 'Exchange approved', next: 'Rider brings a fresh one and collects the old item' }
    case 'resolved':    return { ...base, tone: 'done', pill: ex ? 'EXCHANGED' : 'REFUNDED', title: ex ? 'Exchanged · fresh item delivered' : `${amt} refunded to ${where}`, next: '' }
    case 'rejected':    return { ...base, tone: 'bad', pill: 'NOT APPROVED', title: 'Request not approved', next: c.response ? `“${c.response}”` : '' }
    default:            return { ...base, tone: 'off', pill: 'CANCELLED', title: 'Request cancelled', next: '' }
  }
}
