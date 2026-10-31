import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { homeFor } from '../utils/roles.js'
import PhoneOtp from '../auth/PhoneOtp.jsx'
import StatusScreen from '../auth/StatusScreen.jsx'
import '../auth/auth.css'
import './partner.css'

// ─────────────────────────────────────────────────────────────
//  freshmart.com/partner: ONE login for everyone who runs FreshMart.
//  Mobile -> OTP -> the number decides: store dashboard / picker / delivery / support / owner.
//  Customers shop at freshmart.com (login there opens the customer account of the same number).
// ─────────────────────────────────────────────────────────────
const ROLE = {
  admin:      { label: 'Store admin',      app: 'your store dashboard', bg: '#0b3d2e', accent: '#00a870', ink: '#fff' },
  picker:     { label: 'Picker',           app: 'the picker app',       bg: '#4338ca', accent: '#fbbf24', ink: '#1a1d23' },
  delivery:   { label: 'Delivery partner', app: 'the delivery app',     bg: '#14201b', accent: '#f59e0b', ink: '#14201b' },
  support:    { label: 'Support team',     app: 'the support inbox',    bg: '#be185d', accent: '#fff',    ink: '#be185d' },
  superadmin: { label: 'FreshMart owner',  app: 'the owner panel',      bg: '#14213d', accent: '#fbbf24', ink: '#14213d' },
  customer:   { label: 'Customer',         app: '',                     bg: '#00a870', accent: '#fff',    ink: '#00a870' },
}
const WHO = [['S', 'Store', '#00a870', '#fff'], ['P', 'Picker', '#4338ca', '#fff'], ['D', 'Delivery', '#f59e0b', '#14201b'], ['H', 'Support', '#be185d', '#fff'], ['O', 'Owner', '#fbbf24', '#14213d']]

function Hello({ res, onGo }) {
  const r = ROLE[res.user.role] || ROLE.admin
  useEffect(() => { const t = setTimeout(onGo, 1600); return () => clearTimeout(t) }, [onGo])
  return (
    <div className="pt-hello" style={{ background: r.bg }}>
      <div className="pt-hello-in">
        <span className="pt-av" style={{ background: r.accent, color: r.ink }}>{(res.user.name || r.label).charAt(0)}</span>
        <span className="pt-ver">+91 {res.user.phone} verified</span>
        <h1>Hi {(res.user.name || '').split(' ')[0] || 'there'}!</h1>
        <p>You’re logging in as<br /><b>{r.label}</b>{res.place ? <><br />{res.place}</> : null}</p>
      </div>
      <div className="pt-hello-foot">
        <span className="pt-bar"><span /></span>
        <span>Opening {r.app}…</span>
        <button type="button" className="pt-open" style={{ color: r.bg }} onClick={onGo}>Open {r.app}</button>
      </div>
    </div>
  )
}

export default function PartnerLogin() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [step, setStep]   = useState('phone')     // phone | hello | not_partner | status
  const [res, setRes]     = useState(null)
  const [phone, setPhone] = useState('')
  const [demo, setDemo]   = useState([])
  const [showDemo, setShowDemo] = useState(false)
  const [busy, setBusy]   = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/auth/otp/config').then((c) => {
      if (c.dev_mode) api.get('/api/auth/otp/demo-accounts').then(setDemo).catch(() => {})
    }).catch(() => {})
  }, [])

  // already logged in as staff in this tab -> straight to work (customers stay here to log in as staff)
  if (!loading && user && user.role !== 'customer' && step === 'phone') return <Navigate to={homeFor(user.role)} replace />

  const onVerified = (r, ph) => {
    setPhone(ph); setRes(r)
    if (r.status === 'ok') { signIn(r); setStep('hello') }
    else if (r.status === 'not_partner') setStep('not_partner')
    else setStep('status')
  }
  const go = () => {
    const role = res.user.role
    if (role === 'admin' || role === 'delivery') navigate('/welcome', { replace: true, state: { fresh: true } })
    else navigate(homeFor(role), { replace: true })
  }

  // Test accounts (OTP_DEV_MODE only): number + demo code filled in one tap
  const quick = async (a) => {
    setBusy(a.phone); setError('')
    try {
      const s = await api.post('/api/auth/otp/send', { phone: a.phone })
      const r = await api.post('/api/auth/otp/verify', { phone: a.phone, code: s.dev_code, door: 'partner' })
      onVerified(r, a.phone)
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  if (step === 'hello' && res) return <Hello res={res} onGo={go} />

  return (
    <div className="pt">
      <div className="pt-top">
        <span className="pt-url">freshmart.com/partner</span>
        <div className="pt-brand">
          <span className="pt-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg></span>
          <div><b>FreshMart Partner</b><small>For people who run FreshMart</small></div>
        </div>
        <div className="pt-who" aria-label="Who logs in here">{WHO.map(([l, t, bg, fg]) => <div key={t}><i aria-hidden="true" style={{ background: bg, color: fg }}>{l}</i>{t}</div>)}</div>
      </div>

      <div className="pt-card">
        {step === 'not_partner' ? (
          <div className="au-step pt-np">
            <span className="pt-np-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 7H5" /></svg></span>
            <h2>This number isn’t a partner account</h2>
            <p>+91 {phone} {res?.is_customer ? 'is a FreshMart customer. To shop, use freshmart.com.' : 'is not on FreshMart yet.'}<br />Work at a store or deliver for us? Ask your store admin to add this number in Staff.</p>
            <div className="au-push">
              <Link className="au-btn" to="/">Go to the shop</Link>
              <button type="button" className="au-btn ghost" onClick={() => { setStep('phone'); setRes(null) }}>Try another number</button>
            </div>
          </div>
        ) : step === 'status' && res ? (
          <StatusScreen {...res} onBack={() => { setStep('phone'); setRes(null) }} />
        ) : (
          <>
            <PhoneOtp door="partner" title="Log in to work"
              sub="Use the number your store or FreshMart added. Your own app opens after the OTP."
              note={<>Here to shop? <Link to="/">Go to freshmart.com</Link></>}
              onVerified={onVerified} />
            {demo.length > 0 && (
              <div className="pt-demo">
                <button type="button" className="pt-demo-btn" aria-expanded={showDemo} onClick={() => setShowDemo((v) => !v)}>{showDemo ? 'Hide test accounts' : 'Test accounts (demo only)'}</button>
                {showDemo && (
                  <div className="pt-demo-grid">
                    {demo.map((a) => {
                      const r = ROLE[a.role] || ROLE.admin
                      return (
                        <button key={a.role + a.phone} type="button" disabled={Boolean(busy)} onClick={() => quick(a)}>
                          <i style={{ background: r.bg, color: '#fff' }}>{r.label.charAt(0)}</i>
                          <span>{r.label}<small>{busy === a.phone ? 'Logging in…' : a.name}</small></span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {error && <p className="au-error" role="alert">{error}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
