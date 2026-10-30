import { RANGES } from './useReport.js'

export default function RangeTabs({ days, setDays }) {
  return (
    <div className="ad-tabs compact" role="tablist" aria-label="Time range">
      {RANGES.map(([d, label]) => <button key={d} role="tab" aria-selected={days === d} className={`ad-tab ${days === d ? 'on' : ''}`} onClick={() => setDays(d)}>{label}</button>)}
    </div>
  )
}
