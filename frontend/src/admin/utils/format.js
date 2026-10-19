export const rs = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const asDate = (iso) => new Date(/Z$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`)

export const fmtDateTime = (iso) => iso
  ? asDate(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
  : ''

export const ORDER_STATUS = {
  placed:           { label: 'New',              tone: 'amber' },
  confirmed:        { label: 'Confirmed',        tone: 'blue' },
  packed:           { label: 'Packed',           tone: 'violet' },
  out_for_delivery: { label: 'Out for delivery', tone: 'blue' },
  delivered:        { label: 'Delivered',        tone: 'green' },
  cancelled:        { label: 'Cancelled',        tone: 'red' },
  return_requested: { label: 'Return requested', tone: 'amber' },
  returned:         { label: 'Returned',         tone: 'grey' },
}

// Next step buttons for the store (backend la ALLOWED_TRANSITIONS same rules)
export const NEXT_ACTIONS = {
  placed:           [{ to: 'confirmed', label: 'Accept order' }, { to: 'cancelled', label: 'Reject', danger: true }],
  confirmed:        [{ to: 'packed', label: 'Mark packed' }, { to: 'cancelled', label: 'Cancel', danger: true }],
  packed:           [{ to: 'out_for_delivery', label: 'Send for delivery' }, { to: 'cancelled', label: 'Cancel', danger: true }],
  out_for_delivery: [{ to: 'delivered', label: 'Mark delivered' }],
}

export const PAY_NAMES = { gpay: 'GPay', phonepe: 'PhonePe', paytm: 'Paytm', bhim: 'BHIM', card: 'Card', nb: 'Net Banking', cod: 'Cash on Delivery' }
export const SLOT_NAMES = { now: 'Now (10 min)', hour: 'In 1 hour', night: 'Tonight 7–9 pm', morn: 'Tomorrow 7–9 am' }

export const COMPLAINT_TYPES = {
  return: 'Return', refund: 'Refund', damaged: 'Damaged item', missing_item: 'Missing item',
  quality: 'Quality issue', late_delivery: 'Late delivery', other: 'Other',
}
