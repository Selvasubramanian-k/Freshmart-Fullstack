import { useEffect, useState } from 'react'
import { api } from '../../shared/api/client.js'

// Customer delivery fee, set by the FreshMart owner (Areas & offers -> Delivery charges).
// Loaded once and shared; the backend works it out again when the order is placed.
let cache = null
let loading = null
const DEFAULT = { fee: 25, free_above: 499 }

function load() {
  if (!loading) loading = api.get('/api/delivery-fee').then((r) => { cache = r; return r }).catch(() => DEFAULT)
  return loading
}

export function useDeliveryFee() {
  const [rule, setRule] = useState(cache || DEFAULT)
  useEffect(() => { let live = true; load().then((r) => live && setRule(r)); return () => { live = false } }, [])
  const feeFor = (subtotal) => (subtotal <= 0 || subtotal >= rule.free_above ? 0 : rule.fee)
  const moreForFree = (subtotal) => (rule.fee > 0 && subtotal > 0 && subtotal < rule.free_above ? Math.ceil(rule.free_above - subtotal) : 0)
  return { ...rule, feeFor, moreForFree }
}
