import { useEffect, useState } from 'react'
import { useAuth } from '../../shared/context/AuthContext.jsx'
import PhoneOtp from '../../shared/auth/PhoneOtp.jsx'
import { readAddrs, saveAddrs } from '../utils/addresses.js'
import '../../shared/auth/auth.css'

// ─────────────────────────────────────────────────────────────
//  freshmart.com login (customers only): mobile -> OTP -> shop.
//  New number: 2 short steps (name, then address) and back to shopping.
//  Store / picker / rider / support / owner log in at /partner.
// ─────────────────────────────────────────────────────────────
const LABELS = ['Home', 'Work', 'Other']

export default function LoginSheet({ reason, onClose, onDone }) {
  const { signIn, updateProfile } = useAuth()
  const [step, setStep]   = useState('phone')      // phone | name | address
  const [phone, setPhone] = useState('')
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [a, setA] = useState({ line1: '', line2: '', landmark: '', city: 'Chennai', pincode: '', label: 'Home', lat: null, lng: null })
  const [locating, setLocating] = useState('')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && step === 'phone') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [step, onClose])

  const onVerified = (res, ph) => {
    signIn(res)
    setPhone(ph)
    if (res.needs_profile) setStep('name')
    else onDone(res.user)
  }

  const saveName = async (e) => {
    e.preventDefault()
    if (name.trim().length < 2) return setError('Please enter your name.')
    setBusy(true); setError('')
    try {
      const changes = { name: name.trim() }
      if (email.trim()) changes.email = email.trim()
      await updateProfile(changes)
      setStep('address')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const locateMe = () => {
    if (!navigator.geolocation) return setLocating('Location is not supported on this browser.')
    setLocating('busy')
    navigator.geolocation.getCurrentPosition(
      (p) => { setA((x) => ({ ...x, lat: p.coords.latitude, lng: p.coords.longitude })); setLocating('ok') },
      () => setLocating('Couldn’t get your location. You can type the address.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const saveAddress = async (e) => {
    e.preventDefault()
    if (a.line1.trim().length < 3) return setError('Enter your house / flat number and building.')
    if (a.line2.trim().length < 3) return setError('Enter the street and area.')
    if (!/^\d{6}$/.test(a.pincode)) return setError('Enter the 6-digit pincode.')
    setBusy(true); setError('')
    try {
      const address = {
        line1: a.line1.trim(), line2: a.line2.trim(), landmark: a.landmark.trim() || null, city: a.city.trim() || 'Chennai',
        pincode: a.pincode, ...(a.lat != null ? { lat: a.lat, lng: a.lng } : {}),
      }
      const u = await updateProfile({ address })
      const text = [address.line1, address.line2, address.landmark, `${address.city} ${address.pincode}`].filter(Boolean).join(', ')
      saveAddrs(u, [{ id: Date.now(), label: a.label, text, ...(a.lat != null ? { lat: a.lat, lng: a.lng } : {}) },
        ...readAddrs(u).filter((x) => x.text !== text)])
      onDone(u)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const set = (k) => (e) => { setError(''); setA((x) => ({ ...x, [k]: k === 'pincode' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value })) }

  return (
    <div className="cs-back" onMouseDown={(e) => { if (e.target === e.currentTarget && step === 'phone') onClose() }}>
      <div className={`cs-sheet ${step !== 'phone' ? 'tall' : ''}`} role="dialog" aria-modal="true" aria-label="Log in to FreshMart">
        <span className="cs-grip" aria-hidden="true" />

        {step === 'phone' && (
          <>
            <button type="button" className="cs-x" aria-label="Close" onClick={onClose}>✕</button>
            <PhoneOtp
              door="shop"
              kicker="வணக்கம்!"
              title="Log in to shop"
              sub={reason || 'Log in to add to cart and order. New here? Just enter your number, we make your account.'}
              onVerified={onVerified}
              note={<>Work at a store or deliver? <a href="/partner">Partner login</a></>}
            />
          </>
        )}

        {step === 'name' && (
          <form className="au-step" onSubmit={saveName} noValidate>
            <div className="cs-steps" aria-label="Step 1 of 2"><span className="on" /><span /></div>
            <span className="cs-kick">STEP 1 OF 2</span>
            <div className="au-verified">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              +91 {phone} verified
            </div>
            <div className="au-head"><h2>Welcome to FreshMart! What’s your name?</h2><p>The rider will ask for you by this name.</p></div>
            <label className="au-label" htmlFor="cs-name">Your name</label>
            <input id="cs-name" className="au-input" autoComplete="name" placeholder="e.g. Priya" value={name} autoFocus
              onChange={(e) => { setName(e.target.value); setError('') }} />
            <label className="au-label" htmlFor="cs-email">Email <span>(optional, for bills)</span></label>
            <input id="cs-email" className="au-input" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            {error && <p className="au-error" role="alert">{error}</p>}
            <div className="au-push"><button type="submit" className="au-btn" disabled={busy || name.trim().length < 2}>{busy ? 'Saving…' : 'Next: delivery address'}</button></div>
          </form>
        )}

        {step === 'address' && (
          <form className="au-step" onSubmit={saveAddress} noValidate>
            <div className="cs-steps" aria-label="Step 2 of 2"><span className="on" /><span className="on" /></div>
            <div className="cs-row"><span className="cs-kick">STEP 2 OF 2</span><button type="button" className="cs-link" onClick={() => setStep('name')}>Back</button></div>
            <div className="au-head"><h2>Where should we deliver{name ? `, ${name.trim().split(' ')[0]}` : ''}?</h2></div>
            <button type="button" className={`cs-locate ${locating === 'ok' ? 'ok' : ''}`} onClick={locateMe} disabled={locating === 'busy'}>
              {locating === 'busy' ? 'Getting your location…' : locating === 'ok' ? 'Location pinned ✓ (the rider finds you easily)' : 'Use my current location'}
            </button>
            {locating && !['busy', 'ok'].includes(locating) && <p className="au-note left">{locating}</p>}
            <label className="au-label" htmlFor="cs-l1">House / flat no. &amp; building</label>
            <input id="cs-l1" className="au-input" autoComplete="address-line1" value={a.line1} onChange={set('line1')} placeholder="No. 12, Lakshmi Flats" />
            <label className="au-label" htmlFor="cs-l2">Street &amp; area</label>
            <input id="cs-l2" className="au-input" autoComplete="address-line2" value={a.line2} onChange={set('line2')} placeholder="Gandhi Street, T Nagar" />
            <div className="au-two">
              <div><label className="au-label" htmlFor="cs-lm">Landmark <span>(optional)</span></label><input id="cs-lm" className="au-input" value={a.landmark} onChange={set('landmark')} placeholder="Near temple" /></div>
              <div><label className="au-label" htmlFor="cs-pin">Pincode</label><input id="cs-pin" className="au-input" inputMode="numeric" autoComplete="postal-code" value={a.pincode} onChange={set('pincode')} /></div>
            </div>
            <label className="au-label" htmlFor="cs-city">City</label>
            <input id="cs-city" className="au-input" autoComplete="address-level2" value={a.city} onChange={set('city')} />
            <span className="au-label">Save as</span>
            <div className="au-chips">{LABELS.map((l) => <button key={l} type="button" className={a.label === l ? 'on' : ''} aria-pressed={a.label === l} onClick={() => setA((x) => ({ ...x, label: l }))}>{l}</button>)}</div>
            {error && <p className="au-error" role="alert">{error}</p>}
            <div className="au-push">
              <button type="submit" className="au-btn" disabled={busy}>{busy ? 'Saving…' : 'Save & start shopping'}</button>
              <button type="button" className="cs-skip" onClick={() => onDone(null)}>Skip, I’ll add it at checkout</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
