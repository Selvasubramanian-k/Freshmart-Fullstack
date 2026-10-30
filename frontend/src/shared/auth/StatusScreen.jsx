import { BackLink } from './AuthLayout.jsx'

// Old store owner / delivery partner request (made before invite-only): waiting or not accepted
const WHO = { admin: 'store', delivery: 'delivery partner request' }

export default function StatusScreen({ status, role, name, note, onBack }) {
  const pending = status === 'pending'
  const steps = [
    ['Request sent', 'We have your details', true],
    ['Being checked', pending ? (role === 'admin' ? 'FreshMart checks every new store' : 'The store checks every new delivery partner') : 'Checked', !pending],
    [pending ? 'You’re in!' : 'Not accepted', pending ? 'We’ll send you an SMS' : (note || 'Please contact the store for details'), false],
  ]
  return (
    <div className="au-step">
      {onBack && <BackLink onClick={onBack}>Back to login</BackLink>}
      <div className="au-status">
        <span className={`au-status-ic ${pending ? 'wait' : 'no'}`} aria-hidden="true">
          {pending
            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>}
        </span>
        <h2>{pending ? `Thanks${name ? `, ${name.split(' ')[0]}` : ''}! We’re checking.` : `Your ${WHO[role] || 'request'} was not accepted`}</h2>
        <p>{pending
          ? 'You’ll get an SMS when it’s done. After that, log in with the same number and your own page opens.'
          : 'You can’t log in with this number for now.'}</p>
      </div>
      <ol className="au-timeline">
        {steps.map(([t, s, done], i) => (
          <li key={t} className={done ? 'done' : pending && i === 1 ? 'now' : !pending && i === 2 ? 'bad' : ''}>
            <b>{t}</b><span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
