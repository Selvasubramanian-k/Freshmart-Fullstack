// Admin date ranges (browser local days). Orders + Earnings use this.
export const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const nice = (d, opt = { weekday: 'short', day: 'numeric', month: 'short' }) => d.toLocaleDateString('en-IN', opt)
export function rangeBounds(id, from, to) {
  const today = dayStart(new Date())
  if (id === 'today') return { start: today, end: addDays(today, 1), text: `Today · ${nice(today)}` }
  if (id === 'yesterday') { const y = addDays(today, -1); return { start: y, end: today, text: `Yesterday · ${nice(y)}` } }
  if (id === 'week') {
    const mon = addDays(today, -((today.getDay() + 6) % 7))
    return { start: mon, end: addDays(today, 1), text: `This week · ${nice(mon)} – ${nice(today)}` }
  }
  if (id === 'month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    return { start: first, end: addDays(today, 1), text: `This month · ${nice(first, { day: 'numeric', month: 'short' })} – ${nice(today, { day: 'numeric', month: 'short' })}` }
  }
  if (id === 'custom' && from && to) {
    const a = new Date(`${from}T00:00`), b = new Date(`${to}T00:00`)
    const [s, e] = a <= b ? [a, b] : [b, a]
    return { start: s, end: addDays(e, 1), text: `${nice(s, { day: 'numeric', month: 'short', year: 'numeric' })} – ${nice(e, { day: 'numeric', month: 'short', year: 'numeric' })}` }
  }
  return { start: null, end: null, text: 'All orders' }
}
