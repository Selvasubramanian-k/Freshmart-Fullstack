import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { homeFor } from '../utils/roles.js'
import AuthLayout from '../auth/AuthLayout.jsx'
import PhoneOtp from '../auth/PhoneOtp.jsx'
import StatusScreen from '../auth/StatusScreen.jsx'
import '../auth/auth.css'

// ─────────────────────────────────────────────────────────────
//  Ore URL ellaa role kum: front page -> mobile -> OTP.
//  Number yaaroda nu server paathu sollum:
//    customer / admin / rider (active) -> /welcome (avanga welcome page) -> avanga home
//    pudhu number                      -> name kettu customer account
//    store / rider waiting approval    -> status page
// ─────────────────────────────────────────────────────────────
const DEMO_NUMBERS = [['Customer', '9123456780'], ['Store admin', '9876543210'], ['Delivery', '9840098400']]

export default function Login() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [step, setStep]     = useState('front')     // front | otp | name | status
  const [devMode, setDev]   = useState(false)
  const [signup, setSignup] = useState(null)        // { token, phone }
  const [status, setStatus] = useState(null)        // verify reply for pending / rejected
  const [name, setName]     = useState('')
  const [email, setEmail]   = useState('')
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState('')
  const [leaving, setLeaving] = useState(false)    // just logged in -> going to /welcome (skip the old redirect)

  useEffect(() => { api.get('/api/auth/otp/config').then((c) => setDev(Boolean(c.dev_mode))).catch(() => {}) }, [])

  if (!loading && user && !leaving) return <Navigate to={homeFor(user.role)} replace />

  const goWelcome = (res, isNew = false) => {
    setLeaving(true)
    signIn(res)
    navigate('/welcome', { replace: true, state: { fresh: true, isNew } })
  }

  const onVerified = (res, phone) => {
    if (res.status === 'ok') return goWelcome(res)
    if (res.status === 'new') { setSignup({ token: res.signup_token, phone }); setStep('name'); return }
    setStatus(res); setStep('status')
  }

  const createAccount = async (e) => {
    e.preventDefault()
    if (name.trim().length < 2) return setError('Please enter your name.')
    setBusy(true); setError('')
    try {
      const res = await api.post('/api/auth/otp/signup', { signup_token: signup.token, name: name.trim(), email: email.trim() || null })
      goWelcome(res, true)
    } catch (err) { setError(err.message); setBusy(false) }
  }

  const joinLinks = (
    <p className="au-join">Own a store? <Link to="/join/store">Register your store</Link><span aria-hidden="true"> · </span><Link to="/join/rider">Deliver with us</Link></p>
  )

  return (
    <AuthLayout front={step === 'front'} onStart={() => setStep('otp')} footer={joinLinks}>
      {step === 'front' && (
        <div className="au-step">
          <div className="au-head"><h2>Log in to FreshMart</h2><p>Use your mobile number. We’ll send you a one-time code.</p></div>
          <button type="button" className="au-btn" onClick={() => setStep('otp')}>Get started</button>
          <p className="au-note">New here? Your mobile number makes your account.</p>
          <div className="au-divider" />
          {joinLinks}
        </div>
      )}

      {step === 'otp' && (
        <PhoneOtp onBack={() => setStep('front')} onVerified={onVerified}
          demos={devMode ? DEMO_NUMBERS : []}
          note="New number? We’ll make your account after the OTP." />
      )}

      {step === 'name' && (
        <form className="au-step" onSubmit={createAccount} noValidate>
          <div className="au-verified">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
            +91 {signup.phone} verified
          </div>
          <div className="au-head"><h2>Welcome to FreshMart!</h2><p>You’re new here. Tell us your name and we’ll make your account.</p></div>
          <label className="au-label" htmlFor="au-name">Your name</label>
          <input id="au-name" className="au-input" autoComplete="name" placeholder="e.g. Priya" value={name} autoFocus
            onChange={(e) => { setName(e.target.value); setError('') }} />
          <label className="au-label" htmlFor="au-email">Email <span>(optional, for bills)</span></label>
          <input id="au-email" className="au-input" type="email" autoComplete="email" placeholder="you@example.com" value={email}
            onChange={(e) => setEmail(e.target.value)} />
          <p className="au-note left">You’ll add your delivery address at checkout.</p>
          {error && <p className="au-error" role="alert">{error}</p>}
          <div className="au-push">
            <button type="submit" className="au-btn" disabled={busy || name.trim().length < 2}>{busy ? 'Creating…' : 'Create account'}</button>
            <div className="au-not">
              <span>NOT A CUSTOMER?</span>
              <Link to="/join/store" state={{ signup }}>Register your store <b aria-hidden="true">→</b></Link>
              <Link to="/join/rider" state={{ signup }}>Join as a delivery partner <b aria-hidden="true">→</b></Link>
            </div>
          </div>
        </form>
      )}

      {step === 'status' && status && (
        <StatusScreen {...status} onBack={() => { setStatus(null); setStep('front') }} />
      )}
    </AuthLayout>
  )
}
