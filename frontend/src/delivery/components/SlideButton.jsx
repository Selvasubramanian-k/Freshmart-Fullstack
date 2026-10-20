import { useRef, useState } from 'react'

// Slide-to-confirm (stops accidental taps while riding). Keyboard: focus + Enter.
export default function SlideButton({ label, onConfirm, disabled = false, busy = false, tone = 'green' }) {
  const [value, setValue] = useState(0)
  const anim = useRef(0)

  const reset = (from) => {
    cancelAnimationFrame(anim.current)
    let t0 = null
    const step = (t) => {
      if (t0 === null) t0 = t
      const k = Math.min(1, (t - t0) / 250)
      setValue(Math.round(from * (1 - k)))
      if (k < 1) anim.current = requestAnimationFrame(step)
    }
    anim.current = requestAnimationFrame(step)
  }

  const finish = async (v = value) => {
    if (disabled || busy) return
    if (v < 92) { reset(v); return }
    setValue(100)
    try { await onConfirm() } finally { reset(100) }
  }

  return (
    <div className={`rd-slide ${tone} ${disabled ? 'off' : ''}`} style={{ '--p': value }}>
      <span className="rd-slide-lbl">{busy ? 'Please wait…' : label}</span>
      <input
        type="range" min="0" max="100" value={value} aria-label={label} disabled={disabled || busy}
        onChange={(e) => setValue(Number(e.target.value))}
        onPointerUp={() => finish()}
        onKeyDown={(e) => { if (e.key === 'Enter') finish(100) }}
      />
    </div>
  )
}
