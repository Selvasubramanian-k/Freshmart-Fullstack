import { useEffect } from 'react'
import { X } from 'lucide-react'
import { ORDER_STATUS } from '../utils/format.js'

export function StatusBadge({ status, map = ORDER_STATUS }) {
  const s = map[status] || { label: status, tone: 'grey' }
  return <span className={`ad-badge ${s.tone}`}>{s.label}</span>
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'green', onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`ad-stat ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <span className={`ad-stat-ic ${tone}`}><Icon size={20} /></span>
      <div>
        <p className="ad-stat-label">{label}</p>
        <p className="ad-stat-value">{value}</p>
        {hint && <p className="ad-stat-hint">{hint}</p>}
      </div>
    </Tag>
  )
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="ad-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`ad-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="ad-modal-head">
          <h3>{title}</h3>
          <button className="ad-icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="ad-modal-body">{children}</div>
      </div>
    </div>
  )
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="ad-page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="ad-page-actions">{children}</div>}
    </div>
  )
}

export function Empty({ icon: Icon, title, text, children }) {
  return (
    <div className="ad-empty">
      {Icon && <span className="ad-empty-ic"><Icon size={28} /></span>}
      <p className="ad-empty-title">{title}</p>
      {text && <p>{text}</p>}
      {children}
    </div>
  )
}

export function ErrorNote({ children }) {
  return children ? <p className="ad-error" role="alert">{children}</p> : null
}
