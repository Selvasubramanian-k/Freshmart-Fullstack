import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { BackLink } from './AuthLayout.jsx'

// Mobile number -> OTP. Verify aanadhum parent ku server reply ah kudukkum:
//   { status: 'ok' | 'new' | 'pending' | 'rejected', ... }
const VALID = /^[6-9]\d{9}$/
const fmt = (p) => (p.length > 5 ? `${p.slice(0, 5)} ${p.slice(5)}` : p)

export default function PhoneOtp({
  kicker,
  title = 'Enter your mobile number',
  sub = 'We’ll send a 6-digit code by SMS to log you in.',
  note,
  demos = [],
  onBack,
  onVerified,
}) {
  const [step, setStep]   = useState('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode]   = useState('')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const [left, setLeft]   = useState(0)
  const [devCode, setDevCode] = useState('')
  const codeRef = useRef(null)

  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [left])

  const send = async () => {
    if (!VALID.test(phone)) return setError('Enter a 10-digit mobile number starting with 6, 7, 8 or 9.')
    setBusy(true); setError('')
    try {
      const r = await api.post('/api/auth/otp/send', { phone })
      setDevCode(r.dev_code || '')
      setLeft(r.resend_seconds || 30)
      setCode(''); setStep('otp')
      setTimeout(() => codeRef.current?.focus(), 50)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const verify = async (value = code) => {
    if (!/^\d{6}$/.test(value)) return setError('Enter the 6-digit code.')
    setBusy(true); setError('')
    try {
      const r = await api.post('/api/auth/otp/verify', { phone, code: value })
      await onVerified(r, phone)
    } catch (e) { setError(e.message); setCode('') }
    finally { setBusy(false) }
  }

  const typeCode = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(v); setError('')
    if (v.length === 6) verify(v)
  }

  if (step === 'phone') {
    const ok = VALID.test(phone)
    return (
      <form className="au-step" onSubmit={(e) => { e.preventDefault(); send() }} noValidate>
        {onBack && <BackLink onClick={onBack} />}
        <div className="au-head">{kicker && <span className="au-tamil" lang="ta">{kicker}</span>}<h2>{title}</h2><p>{sub}</p></div>
        <label className="au-label" htmlFor="au-phone">Mobile number</label>
        <div className={`au-phone ${ok ? 'ok' : ''}`}>
          <span>+91</span>
          <input id="au-phone" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10-digit number"
            value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError('') }} />
        </div>
        {error && <p className="au-error" role="alert">{error}</p>}
        {demos.length > 0 && (
          <div className="au-demos">
            <span>Demo numbers</span>
            <div>{demos.map(([label, num]) => <button key={num} type="button" onClick={() => { setPhone(num); setError('') }}>{label}</button>)}</div>
          </div>
        )}
        <div className="au-push">
          <button type="submit" className="au-btn" disabled={!ok || busy}>{busy ? 'Sending…' : 'Get OTP'}</button>
          {note && <p className="au-note">{note}</p>}
        </div>
      </form>
    )
  }

  return (
    <form className="au-step" onSubmit={(e) => { e.preventDefault(); verify() }} noValidate>
      <BackLink onClick={() => { setStep('phone'); setError('') }}>Change number</BackLink>
      <div className="au-head">
        <h2>Enter the code</h2>
        <p>Sent by SMS to <b>+91 {fmt(phone)}</b></p>
      </div>
      <label className="au-sr" htmlFor="au-code">6-digit code</label>
      <div className="au-otp">
        <div className="au-otp-boxes" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={`${code[i] ? 'filled' : ''} ${i === code.length ? 'cur' : ''}`}>{code[i] || ''}</span>
          ))}
        </div>
        <input id="au-code" ref={codeRef} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          value={code} onChange={typeCode} disabled={busy} />
      </div>
      {error && <p className="au-error" role="alert">{error}</p>}
      <div className="au-resend">
        {left > 0 ? <span>Resend code in 0:{String(left).padStart(2, '0')}</span>
          : <button type="button" onClick={send} disabled={busy}>Resend code</button>}
        {devCode && <span className="au-dev">Demo code: <b>{devCode}</b></span>}
      </div>
      <div className="au-push">
        <button type="submit" className="au-btn" disabled={code.length !== 6 || busy}>{busy ? 'Checking…' : 'Verify & continue'}</button>
      </div>
    </form>
  )
}
