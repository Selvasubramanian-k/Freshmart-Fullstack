import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ShoppingBasket, Store } from 'lucide-react'
import AuthShell from '../components/AuthShell.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { homeFor } from '../utils/roles.js'

// ─────────────────────────────────────────────────────────────
//  Register: role choose pannunga -> andha role ku venumana details.
//    Customer    -> personal details + delivery address
//    Store owner -> personal details + store details (name, GST, address, timings)
//  /register?role=admin nu open panna Store owner select aagi irukkum.
// ─────────────────────────────────────────────────────────────
const ROLES = [
  { id: 'customer', label: 'Customer',    sub: 'Shop groceries',     Icon: ShoppingBasket },
  { id: 'admin',    label: 'Store owner', sub: 'Sell on FreshMart', Icon: Store },
]
const STATES = ['Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Puducherry', 'Maharashtra', 'Delhi', 'Other']
const STORE_TYPES = ['Grocery', 'Supermarket', 'Fruits & Vegetables', 'Dairy', 'Meat & Fish', 'Organic', 'Pet store']

const EMPTY = {
  name: '', email: '', phone: '', password: '', confirm: '',
  line1: '', landmark: '', city: '', state: 'Tamil Nadu', pincode: '',
  storeName: '', gst: '', storeType: 'Grocery', openTime: '08:00', closeTime: '22:00',
}

const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

function validate(role, f) {
  if (f.name.trim().length < 2)              return 'Please enter your full name.'
  if (!/^\S+@\S+\.\S+$/.test(f.email))       return 'Please enter a valid email address.'
  if (!/^[6-9]\d{9}$/.test(f.phone))         return 'Enter a valid 10-digit mobile number.'
  if (f.password.length < 6)                 return 'Password must be at least 6 characters.'
  if (f.password !== f.confirm)              return 'Passwords do not match.'
  if (role === 'admin') {
    if (f.storeName.trim().length < 2)       return 'Please enter your store name.'
    if (f.gst && !GST_RE.test(f.gst))        return 'GST number looks wrong (15 characters, e.g. 33ABCDE1234F1Z5).'
    if (f.openTime >= f.closeTime)           return 'Closing time must be after opening time.'
  }
  if (f.line1.trim().length < 3)             return role === 'admin' ? 'Please enter the store address.' : 'Please enter your address.'
  if (f.city.trim().length < 2)              return 'Please enter the city.'
  if (!/^\d{6}$/.test(f.pincode))            return 'Pincode must be 6 digits.'
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

export default function Register() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [role, setRole]       = useState(params.get('role') === 'admin' ? 'admin' : 'customer')
  const [form, setForm]       = useState(EMPTY)
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

  return (
    <AuthShell
      wide
      tagline={isAdmin ? 'Grow your store with FreshMart' : 'Your kitchen, always stocked'}
      subline={isAdmin
        ? 'List your products, manage stock and orders, and track your earnings from one dashboard.'
        : 'Fruits, vegetables, dairy and daily essentials, delivered to your door.'}
    >
      <form className="login-form" onSubmit={submit} noValidate>
        <div className="login-head">
          <h2 className="login-title">Create your account</h2>
          <p className="login-sub">Choose how you want to use FreshMart</p>
        </div>

        <div className="reg-roles" role="radiogroup" aria-label="Account type">
          {ROLES.map(({ id, label, sub, Icon }) => (
            <button
              type="button" key={id} role="radio" aria-checked={role === id}
              className={`reg-role ${role === id ? 'on' : ''}`}
              onClick={() => { setRole(id); setError('') }}
            >
              <span className="reg-role-ic"><Icon size={20} /></span>
              <b>{label}</b>
              <span>{sub}</span>
            </button>
          ))}
        </div>

        <p className="reg-section">Your details</p>
        <input className="login-input" placeholder="Full name" aria-label="Full name" autoComplete="name" value={form.name} onChange={set('name')} />
        <input className="login-input" type="email" placeholder="you@example.com" aria-label="Email" autoComplete="email" value={form.email} onChange={set('email')} />
        <div className="login-phone">
          <span className="login-prefix">+91</span>
          <input type="tel" inputMode="numeric" placeholder="Mobile number" aria-label="Mobile number" autoComplete="tel-national" value={form.phone} onChange={set('phone')} />
        </div>
        <div className="reg-grid">
          <input className="login-input" type="password" placeholder="Password" aria-label="Password" autoComplete="new-password" value={form.password} onChange={set('password')} />
          <input className="login-input" type="password" placeholder="Confirm password" aria-label="Confirm password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
        </div>

        {isAdmin && (
          <>
            <p className="reg-section">Store details</p>
            <input className="login-input" placeholder="Store name, e.g. FreshMart Anna Nagar" aria-label="Store name" value={form.storeName} onChange={set('storeName')} />
            <div className="reg-grid">
              <select className="login-input" aria-label="Store type" value={form.storeType} onChange={set('storeType')}>
                {STORE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <input className="login-input" placeholder="GST number (optional)" aria-label="GST number" value={form.gst} onChange={set('gst')} />
            </div>
            <div className="reg-grid">
              <label className="reg-time">Opens at<input className="login-input" type="time" value={form.openTime} onChange={set('openTime')} /></label>
              <label className="reg-time">Closes at<input className="login-input" type="time" value={form.closeTime} onChange={set('closeTime')} /></label>
            </div>
          </>
        )}

        <p className="reg-section">{isAdmin ? 'Store address' : 'Delivery address'}</p>
        <input className="login-input" placeholder="Flat / door no., street, area" aria-label="Address line" autoComplete="address-line1" value={form.line1} onChange={set('line1')} />
        <input className="login-input" placeholder="Landmark (optional)" aria-label="Landmark" value={form.landmark} onChange={set('landmark')} />
        <div className="reg-grid">
          <input className="login-input" placeholder="City" aria-label="City" autoComplete="address-level2" value={form.city} onChange={set('city')} />
          <input className="login-input" inputMode="numeric" placeholder="Pincode" aria-label="Pincode" autoComplete="postal-code" value={form.pincode} onChange={set('pincode')} />
        </div>
        <select className="login-input" aria-label="State" value={form.state} onChange={set('state')}>
          {STATES.map((s) => <option key={s}>{s}</option>)}
        </select>

        {error && <p className="login-error" role="alert">{error}</p>}

        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? <span className="login-spinner" /> : isAdmin ? 'Create store account' : 'Create account'}
        </button>

        <div className="login-links">
          <span className="login-sub">Already have an account?</span>
          <Link className="login-link" to="/login">Sign in</Link>
        </div>
        <p className="login-terms">By continuing you agree to our Terms of Service and Privacy Policy.</p>
      </form>
    </AuthShell>
  )
}
