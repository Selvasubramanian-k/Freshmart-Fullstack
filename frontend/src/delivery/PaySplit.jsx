// "₹20 delivery + ₹12 for 2.4 km + ₹10 tip" so the rider knows where the money comes from
const r = (n) => `₹${Math.round(n)}`

export default function PaySplit({ pay, className = 'rd-split' }) {
  if (!pay) return null
  const parts = [`${r(pay.base)} delivery`]
  if (pay.distance > 0) parts.push(`${r(pay.distance)} for ${pay.km} km${pay.km_known ? '' : ' (approx.)'}`)
  if (pay.tip > 0) parts.push(`${r(pay.tip)} tip`)
  return <p className={className}>{parts.join(' + ')}</p>
}
