// Simple dependency-free bar chart (CSS bars). data = [{ label, value }]
export default function BarChart({ data, format = (v) => v }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="ad-bars-wrap">
      <p className="ad-bars-total">{format(total)} <span className="ad-muted">total</span></p>
      <div className="ad-bars" role="img" aria-label={data.map(d => `${d.label}: ${format(d.value)}`).join(', ')}>
        {data.map(d => (
          <div className="ad-bar-col" key={d.label} title={`${d.label}: ${format(d.value)}`}>
            <div className="ad-bar-track">
              <div className={`ad-bar ${d.value === 0 ? 'zero' : ''}`} style={{ height: `${(d.value / max) * 100}%` }} />
            </div>
            <span className="ad-bar-lbl">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
