import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import AuthLayout, { BackLink } from '../auth/AuthLayout.jsx'
import PhoneOtp from '../auth/PhoneOtp.jsx'
import StatusScreen from '../auth/StatusScreen.jsx'
import '../auth/auth.css'

// Store owner sign-up: mobile + OTP -> store details -> shop address -> waiting for approval
const TYPES = ['Grocery', 'Supermarket', 'Fruits & Veg', 'Dairy']
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export default function JoinStore() {
  const location = useLocation()
  const navigate = useNavigate()
  const [signup, setSignup] = useState(location.state?.signup || null)   // { token, phone }
  const [step, setStep]     = useState(signup ? 1 : 0)                    // 0 otp, 1 details, 2 address, 3 done
  const [taken, setTaken]   = useState(null)
  const [status, setStatus] = useState(null)
  const [f, setF] = useState({ owner: '', email: '', store: '', type: 'Grocery', open: '07:00', close: '22:00', gst: '',
    line1: '', city: 'Chennai', pincode: '', lat: null, lng: null, agree: false })
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const [locMsg, setLocMsg] = useState('')
  const set = (k) => (e) => { setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })); setError('') }

  const onVerified = (res, phone) => {
    if (res.status === 'new') { setSignup({ token: res.signup_token, phone }); setStep(1); return }
    if (res.status === 'ok') { setTaken(phone); return }
    setStatus(res); setStep(3)
  }

  const next = () => {
    if (f.owner.trim().length < 2) return setError('Enter your name.')
    if (f.store.trim().length < 2) return setError('Enter the store name.')
    if (!TIME.test(f.open) || !TIME.test(f.close)) return setError('Enter opening and closing times.')
    setStep(2)
  }

  const locate = () => {
    if (!navigator.geolocation) return setLocMsg('Location is not available on this device.')
    setLocMsg('Finding your location…')
    navigator.geolocation.getCurrentPosition(
      (p) => { setF((s) => ({ ...s, lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) })); setLocMsg('Shop location saved.') },
      () => setLocMsg('Couldn’t get your location. You can set it later in Store settings.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    if (f.line1.trim().length < 3) return setError('Enter the shop address.')
    if (f.city.trim().length < 2) return setError('Enter the city.')
    if (!/^\d{6}$/.test(f.pincode)) return setError('Enter a 6-digit pincode.')
    if (!f.agree) return setError('Please accept the seller terms.')
    setBusy(true); setError('')
    try {
      const res = await api.post('/api/auth/otp/register-store', {
        signup_token: signup.token, name: f.owner.trim(), email: f.email.trim() || null,
        store: {
          name: f.store.trim(), category: f.type, open_time: f.open, close_time: f.close, gst_number: f.gst.trim() || null,
          address: { line1: f.line1.trim(), city: f.city.trim(), pincode: f.pincode, lat: f.lat, lng: f.lng },
        },
      })
      setStatus(res); setStep(3)
    } catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <AuthLayout>
      {step === 0 && !taken && (
        <PhoneOtp title="Register your store" sub="First, verify the mobile number you’ll use to log in."
          onBack={() => navigate('/login')} onVerified={onVerified} />
      )}
      {step === 0 && taken && (
        <div className="au-step">
          <BackLink onClick={() => setTaken(null)}>Use another number</BackLink>
          <div className="au-head"><h2>This number already has an account</h2>
            <p>+91 {taken} is already on FreshMart. Use a different number for your store, or log in.</p></div>
          <Link className="au-btn" to="/login">Log in instead</Link>
        </div>
      )}

      {(step === 1 || step === 2) && (
        <form className="au-step" onSubmit={step === 1 ? (e) => { e.preventDefault(); next() } : submit} noValidate>
          <BackLink onClick={() => (step === 2 ? setStep(1) : navigate('/login'))} />
          <div className="au-head"><h2>Register your store</h2><p>{step === 1 ? 'Step 1 of 2 · Store details' : 'Step 2 of 2 · Shop address'}</p></div>
          <div className="au-progress"><span className="on" /><span className={step === 2 ? 'on' : ''} /></div>
          <div className="au-verified small">+91 {signup.phone} verified</div>

          {step === 1 ? (
            <>
              <label className="au-label" htmlFor="js-owner">Your name</label>
              <input id="js-owner" className="au-input" value={f.owner} onChange={set('owner')} autoComplete="name" autoFocus />
              <label className="au-label" htmlFor="js-store">Store name</label>
              <input id="js-store" className="au-input" value={f.store} onChange={set('store')} placeholder="e.g. FreshMart Velachery" />
              <span className="au-label">Store type</span>
              <div className="au-chips" role="group" aria-label="Store type">
                {TYPES.map((t) => <button key={t} type="button" className={f.type === t ? 'on' : ''} aria-pressed={f.type === t} onClick={() => setF((s) => ({ ...s, type: t }))}>{t}</button>)}
              </div>
              <div className="au-two">
                <div><label className="au-label" htmlFor="js-open">Opens</label><input id="js-open" className="au-input" type="time" value={f.open} onChange={set('open')} /></div>
                <div><label className="au-label" htmlFor="js-close">Closes</label><input id="js-close" className="au-input" type="time" value={f.close} onChange={set('close')} /></div>
              </div>
              <label className="au-label" htmlFor="js-gst">GST number <span>(optional)</span></label>
              <input id="js-gst" className="au-input" value={f.gst} onChange={set('gst')} maxLength={15} placeholder="33ABCDE1234F1Z5" />
              <label className="au-label" htmlFor="js-email">Email <span>(optional)</span></label>
              <input id="js-email" className="au-input" type="email" value={f.email} onChange={set('email')} />
            </>
          ) : (
            <>
              <label className="au-label" htmlFor="js-line1">Shop address</label>
              <input id="js-line1" className="au-input" value={f.line1} onChange={set('line1')} placeholder="Door no, street, area" autoFocus />
              <div className="au-two">
                <div><label className="au-label" htmlFor="js-city">City</label><input id="js-city" className="au-input" value={f.city} onChange={set('city')} /></div>
                <div><label className="au-label" htmlFor="js-pin">Pincode</label><input id="js-pin" className="au-input" inputMode="numeric" maxLength={6} value={f.pincode} onChange={(e) => { setF((s) => ({ ...s, pincode: e.target.value.replace(/\D/g, '') })); setError('') }} /></div>
              </div>
              <button type="button" className="au-btn ghost" onClick={locate}>
                {f.lat ? 'Shop location saved ✓ (tap to update)' : 'I’m at the shop: use my location'}
              </button>
              {locMsg && <p className="au-note left">{locMsg}</p>}
              <label className="au-check"><input type="checkbox" checked={f.agree} onChange={set('agree')} /> I agree to FreshMart’s seller terms and the commission on online orders.</label>
            </>
          )}

          {error && <p className="au-error" role="alert">{error}</p>}
          <div className="au-push">
            <button type="submit" className="au-btn" disabled={busy}>{step === 1 ? 'Next: shop address' : busy ? 'Sending…' : 'Submit for review'}</button>
          </div>
        </form>
      )}

      {step === 3 && status && <StatusScreen {...status} onBack={() => navigate('/login')} />}
    </AuthLayout>
  )
}
