// Saved delivery addresses (Checkout + Account page share this).
// localStorage la save aagum; first time la register panna address default ah varum.
const addrKey = (u) => `freshmart_addresses:${(u?.email || u?.phone || 'guest').toLowerCase()}`

export function formatAddress(a) {
  if (!a) return ''
  return [a.line1, a.line2, a.landmark, a.city, a.state && `${a.state} ${a.pincode || ''}`.trim()]
    .filter(Boolean).join(', ')
}

export function readAddrs(user) {
  try {
    const a = JSON.parse(localStorage.getItem(addrKey(user)))
    if (Array.isArray(a)) return a
  } catch { /* storage blocked / bad json */ }
  return user?.address ? [{ id: 1, label: 'Home', text: formatAddress(user.address) }] : []
}

export function saveAddrs(user, list) {
  try { localStorage.setItem(addrKey(user), JSON.stringify(list)) } catch { /* storage blocked */ }
}
