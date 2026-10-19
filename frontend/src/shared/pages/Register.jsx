import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { homeFor } from '../utils/roles.js'

// ─────────────────────────────────────────────────────────────
//  Register (design B3): picture role cards + floating label inputs.
//    Customer    -> name, mobile, email, password + delivery address
//    Store owner -> same + store details (name, type, timings, GST) + store address
//  /register?role=admin nu open panna Store owner select aagi irukkum.
//  Styles: src/shared/shared.css la "REGISTER (B3)" section.
// ─────────────────────────────────────────────────────────────
const STATES = ['Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Puducherry', 'Maharashtra', 'Delhi', 'Other']
const STORE_TYPES = ['Grocery', 'Supermarket', 'Fruits & Veg', 'Dairy', 'Meat & Fish', 'Organic']

const EMPTY = {
  name: '', email: '', phone: '', password: '',
  line1: '', landmark: '', city: '', state: 'Tamil Nadu', pincode: '',
  storeName: '', gst: '', storeType: 'Grocery', openTime: '08:00', closeTime: '22:00',
}

const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

function validate(role, f) {
  if (f.name.trim().length < 2)        return 'Please enter your full name.'
  if (!/^[6-9]\d{9}$/.test(f.phone))   return 'Enter a valid 10-digit mobile number.'
  if (!/^\S+@\S+\.\S+$/.test(f.email)) return 'Please enter a valid email address.'
  if (f.password.length < 6)           return 'Password must be at least 6 characters.'
  if (role === 'admin') {
    if (f.storeName.trim().length < 2) return 'Please enter your store name.'
    if (f.gst && !GST_RE.test(f.gst))  return 'GST number looks wrong (15 characters, e.g. 33ABCDE1234F1Z5).'
    if (f.openTime >= f.closeTime)     return 'Closing time must be after opening time.'
  }
  if (f.line1.trim().length < 3)       return role === 'admin' ? 'Please enter the store address.' : 'Please enter your address.'
  if (f.city.trim().length < 2)        return 'Please enter the city.'
  if (!/^\d{6}$/.test(f.pincode))      return 'Pincode must be 6 digits.'
  return ''
}

function buildPayload(role, f) {
  const address = {
    line1: f.line1.trim(),
    landmark: f.landmark.trim() || null,
    city: f.city.trim(),
    state: f.state,
    pincode: f.pincode,
  }
  const base = { role, name: f.name.trim(), email: f.email.trim().toLowerCase(), phone: f.phone, password: f.password }
  if (role === 'customer') return { ...base, address }
  return {
    ...base,
    store: {
      name: f.storeName.trim(),
      gst_number: f.gst || null,
      category: f.storeType,
      open_time: f.openTime,
      close_time: f.closeTime,
      address,
    },
  }
}

// 0-4 strength score for the password meter
function strength(pw) {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 6) s++
  if (pw.length >= 10) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++
  return Math.max(1, s)
}
const STRENGTH_LABEL = ['', 'Weak password', 'Okay password', 'Good password', 'Strong password']

// Floating-label field: label sits inside the box, above the value
function Field({ label, hint, className = '', children }) {
  return (
    <label className={`reg3-field ${className}`}>
      <span className="reg3-label">{label}{hint && <em> {hint}</em>}</span>
      {children}
    </label>
  )
}

function CustomerArt({ on }) {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill={on ? '#d6efe3' : '#f1f3f4'} />
      <path d="M16 24h32l-3 22H19z" fill={on ? '#00a870' : '#9aa3ad'} />
      <path d="M25 24v-4a7 7 0 0 1 14 0v4" fill="none" stroke={on ? '#007a50' : '#7c8691'} strokeWidth="3" strokeLinecap="round" />
      <circle cx="27" cy="33" r="4" fill={on ? '#f5a623' : '#c9d1d6'} />
      <circle cx="37" cy="35" r="4" fill={on ? '#e85d4a' : '#c9d1d6'} />
    </svg>
  )
}

function StoreArt({ on }) {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill={on ? '#d6efe3' : '#f1f3f4'} />
      <path d="M14 26 18 16h28l4 10z" fill={on ? '#00a870' : '#9aa3ad'} />
      <rect x="17" y="26" width="30" height="20" fill={on ? '#b7e4d2' : '#c9d1d6'} />
      <rect x="28" y="34" width="8" height="12" fill={on ? '#007a50' : '#7c8691'} />
    </svg>
  )
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8h14l-1.5 12h-11z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  )
}

export default function Register() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [role, setRole]       = useState(params.get('role') === 'admin' ? 'admin' : 'customer')
  const [form, setForm]       = useState(EMPTY)
  const [showPw, setShowPw]   = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  if (user && !loading) return <Navigate to={homeFor(user.role)} replace />

  const set = (key) => (e) => {
    let v = e.target.value
    if (key === 'phone' || key === 'pincode') v = v.replace(/\D/g, '').slice(0, key === 'phone' ? 10 : 6)
    if (key === 'gst') v = v.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15)
    setForm((f) => ({ ...f, [key]: v }))
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    const msg = validate(role, form)
    if (msg) { setError(msg); return }
    setLoading(true); setError('')
    try {
      const u = await register(buildPayload(role, form))
      navigate(homeFor(u.role), { replace: true })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const isAdmin = role === 'admin'
  const pw = strength(form.password)

  return (
    <div className="reg3-page">
      <svg className="reg3-bg" viewBox="0 0 1280 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <circle cx="90" cy="120" r="170" fill="#d6efe3" />
        <circle cx="1210" cy="700" r="210" fill="#d6efe3" />
        <g fill="none" stroke="#9fd6bd" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M150 560c0-40 30-70 70-70 0 40-30 70-70 70z" /><path d="M150 560l45-45" />
          <circle cx="1100" cy="150" r="34" /><path d="M1100 116c0-12 6-22 18-26" />
          <path d="M1060 330l50 50 m-40-40c-20-10-24-34-8-44" />
        </g>
      </svg>

      <form className="reg3-card" onSubmit={submit} noValidate>
        <div className="reg3-head">
          <div className="reg3-logo"><Logo /></div>
          <h1>Join FreshMart</h1>
          <p>Who are you signing up as?</p>
        </div>

        <div className="reg3-roles" role="radiogroup" aria-label="Account type">
          {[
            { id: 'customer', label: 'Customer',    sub: 'Shop groceries',    Art: CustomerArt },
            { id: 'admin',    label: 'Store owner', sub: 'Sell on FreshMart', Art: StoreArt },
          ].map(({ id, label, sub, Art }) => (
            <button
              type="button" key={id} role="radio" aria-checked={role === id}
              className={`reg3-role ${role === id ? 'on' : ''}`}
              onClick={() => { setRole(id); setError('') }}
            >
              {role === id && (
                <span className="reg3-tick" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
                </span>
              )}
              <Art on={role === id} />
              <b>{label}</b>
              <span>{sub}</span>
            </button>
          ))}
        </div>

        {/* ── Your details ── */}
        <div className="reg3-fields">
          <Field label="Full name">
            <input autoComplete="name" placeholder="Karthik R" value={form.name} onChange={set('name')} />
          </Field>
          <div className="reg3-row">
            <Field label="Mobile">
              <span className="reg3-prefix">
                <span>+91</span>
                <input type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98400 12345" value={form.phone} onChange={set('phone')} />
              </span>
            </Field>
            <Field label="Pincode">
              <input inputMode="numeric" autoComplete="postal-code" placeholder="600042" value={form.pincode} onChange={set('pincode')} />
            </Field>
          </div>
          <Field label="Email">
            <input type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Password">
            <span className="reg3-pw">
              <input type={showPw ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 6 characters" value={form.password} onChange={set('password')} />
              <button type="button" className="reg3-eye" aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw((s) => !s)}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </Field>
          {form.password && (
            <div className={`reg3-meter s${pw}`} aria-live="polite">
              <span /><span /><span /><span />
              <em>{STRENGTH_LABEL[pw]}</em>
            </div>
          )}
        </div>

        {/* ── Store details (store owner only) ── */}
        {isAdmin && (
          <div className="reg3-fields">
            <p className="reg3-section">Store details</p>
            <Field label="Store name">
              <input placeholder="Meena Fresh Mart" value={form.storeName} onChange={set('storeName')} />
            </Field>
            <div className="reg3-chips" role="radiogroup" aria-label="Store type">
              {STORE_TYPES.map((t) => (
                <button
                  type="button" key={t} role="radio" aria-checked={form.storeType === t}
                  className={`reg3-chip ${form.storeType === t ? 'on' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, storeType: t }))}
                >{t}</button>
              ))}
            </div>
            <div className="reg3-row">
              <Field label="Opens at">
                <input type="time" value={form.openTime} onChange={set('openTime')} />
              </Field>
              <Field label="Closes at">
                <input type="time" value={form.closeTime} onChange={set('closeTime')} />
              </Field>
            </div>
            <Field label="GST number" hint="(optional)">
              <input placeholder="33ABCDE1234F1Z5" value={form.gst} onChange={set('gst')} />
            </Field>
          </div>
        )}

        {/* ── Address ── */}
        <div className="reg3-fields">
          <p className="reg3-section">{isAdmin ? 'Store address' : 'Delivery address'}</p>
          <Field label="Flat / door no., street, area">
            <input autoComplete="address-line1" placeholder="7, Lake View Road, Velachery" value={form.line1} onChange={set('line1')} />
          </Field>
          <div className="reg3-row">
            <Field label="City">
              <input autoComplete="address-level2" placeholder="Chennai" value={form.city} onChange={set('city')} />
            </Field>
            <Field label="State">
              <select value={form.state} onChange={set('state')}>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Landmark" hint="(optional)">
            <input placeholder="Near bus stop" value={form.landmark} onChange={set('landmark')} />
          </Field>
        </div>

        {error && <p className="login-error" role="alert">{error}</p>}

        <button type="submit" className="reg3-submit" disabled={loading}>
          {loading ? <span className="login-spinner" /> : isAdmin ? 'Create store account' : 'Create account'}
        </button>
        <p className="reg3-foot">Already a member? <Link to="/login">Sign in</Link></p>
      </form>
    </div>
  )
}
