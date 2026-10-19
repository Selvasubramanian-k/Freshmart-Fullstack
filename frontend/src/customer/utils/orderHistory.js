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
