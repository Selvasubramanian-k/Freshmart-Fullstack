import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import AuthLayout, { BackLink } from '../auth/AuthLayout.jsx'
import PhoneOtp from '../auth/PhoneOtp.jsx'
import StatusScreen from '../auth/StatusScreen.jsx'
import '../auth/auth.css'

// Delivery partner sign-up: mobile + OTP -> details -> waiting for the store to approve
const VEHICLES = [['bike', 'Bike'], ['scooter', 'Scooter'], ['cycle', 'Cycle']]

export default function JoinRider() {
  const location = useLocation()
  const navigate = useNavigate()
  const [signup, setSignup] = useState(location.state?.signup || null)
  const [step, setStep]     = useState(signup ? 1 : 0)       // 0 otp, 1 form, 2 done
  const [taken, setTaken]   = useState(null)
  const [status, setStatus] = useState(null)
  const [f, setF] = useState({ name: '', vehicle: 'bike', number: '', licence: '', photo: '', area: '' })
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => { setF((s) => ({ ...s, [k]: e.target.value })); setError('') }
  const motor = f.vehicle !== 'cycle'

  const onVerified = (res, phone) => {
    if (res.status === 'new') { setSignup({ token: res.signup_token, phone }); setStep(1); return }
    if (res.status === 'ok') { setTaken(phone); return }
    setStatus(res); setStep(2)
  }

  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError('')
    try {
      const r = await api.upload('/api/auth/otp/upload', file, { signup_token: signup.token })
      setF((s) => ({ ...s, photo: r.image_url }))
    } catch (err) { setError(err.message) }
    finally { setUploading(false); e.target.value = '' }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (f.name.trim().length < 2) return setError('Enter your full name.')
    if (motor && f.number.trim().length < 4) return setError('Enter your vehicle number.')
    if (motor && f.licence.trim().length < 5) return setError('Enter your driving licence number.')
    if (f.area.trim().length < 2) return setError('Enter the area you want to deliver in.')
    setBusy(true); setError('')
    try {
      const res = await api.post('/api/auth/otp/join-rider', {
        signup_token: signup.token, name: f.name.trim(), area: f.area.trim(),
        vehicle: { type: f.vehicle, number: motor ? f.number.trim() : '' },
        licence_number: motor ? f.licence.trim() : null, licence_photo: motor ? f.photo || null : null,
      })
      setStatus(res); setStep(2)
    } catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <AuthLayout>
      {step === 0 && !taken && (
        <PhoneOtp title="Join as a delivery partner" sub="Earn per delivery and choose your hours. First, verify your mobile number."
          onBack={() => navigate('/login')} onVerified={onVerified} />
      )}
      {step === 0 && taken && (
        <div className="au-step">
          <BackLink onClick={() => setTaken(null)}>Use another number</BackLink>
          <div className="au-head"><h2>This number already has an account</h2>
            <p>+91 {taken} is already on FreshMart. Use a different number, or log in.</p></div>
          <Link className="au-btn" to="/login">Log in instead</Link>
        </div>
      )}

      {step === 1 && (
        <form className="au-step" onSubmit={submit} noValidate>
          <BackLink onClick={() => navigate('/login')} />
          <div className="au-head"><h2>Join as a delivery partner</h2><p>Earn per delivery · choose your hours</p></div>
          <div className="au-verified small">+91 {signup.phone} verified</div>
          <label className="au-label" htmlFor="jr-name">Full name <span>(as on licence)</span></label>
          <input id="jr-name" className="au-input" value={f.name} onChange={set('name')} autoComplete="name" autoFocus />
          <span className="au-label">Vehicle</span>
          <div className="au-chips three" role="group" aria-label="Vehicle">
            {VEHICLES.map(([id, label]) => <button key={id} type="button" className={f.vehicle === id ? 'on amber' : ''} aria-pressed={f.vehicle === id} onClick={() => setF((s) => ({ ...s, vehicle: id }))}>{label}</button>)}
          </div>
          {motor && (
            <>
              <label className="au-label" htmlFor="jr-num">Vehicle number</label>
              <input id="jr-num" className="au-input upper" value={f.number} onChange={set('number')} placeholder="TN 09 AB 1234" maxLength={15} />
              <label className="au-label" htmlFor="jr-dl">Driving licence number</label>
              <input id="jr-dl" className="au-input upper" value={f.licence} onChange={set('licence')} maxLength={30} />
              <span className="au-label">Licence photo <span>(optional, helps the store approve faster)</span></span>
              <label className={`au-upload ${f.photo ? 'done' : ''}`}>
                {uploading ? 'Uploading…' : f.photo ? 'Licence photo added ✓ (tap to change)' : '+ Add a photo of your licence'}
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={upload} />
              </label>
            </>
          )}
          <label className="au-label" htmlFor="jr-area">Area you want to deliver in</label>
          <input id="jr-area" className="au-input" value={f.area} onChange={set('area')} placeholder="e.g. Velachery, Chennai" />
          {error && <p className="au-error" role="alert">{error}</p>}
          <div className="au-push">
            <button type="submit" className="au-btn amber" disabled={busy || uploading}>{busy ? 'Sending…' : 'Send request'}</button>
            <p className="au-note">The store checks your details before you can take orders.</p>
          </div>
        </form>
      )}

      {step === 2 && status && <StatusScreen {...status} onBack={() => navigate('/login')} />}
    </AuthLayout>
  )
}
