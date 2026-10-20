import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { homeFor } from '../utils/roles.js'

// ─────────────────────────────────────────────────────────────
//  ORE login page ella role kum. Login aanadhum role paathu redirect:
//    customer -> /        (customer dashboard / shop)
//    admin    -> /admin   (store admin dashboard)
// ─────────────────────────────────────────────────────────────
export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  if (user) return <Navigate to={homeFor(user.role)} replace />

  const submit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) { setError('Please enter your email and password.'); return }
    setLoading(true); setError('')
    try {
      const u = await login(email.trim(), password, remember)
      const from = location.state?.from
      const home = homeFor(u.role)
      // same role area ku mattum thirumba anuppum (customer -> /admin poga koodadhu)
      const area = (p) => (p.startsWith('/admin') ? 'admin' : p.startsWith('/delivery') ? 'delivery' : 'customer')
      const back = from && area(from) === u.role
      navigate(back ? from : home, { replace: true })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <form className="login-form" onSubmit={submit} noValidate>
        <div className="login-head">
          <h2 className="login-title">Welcome back</h2>
          <p className="login-sub">Sign in to continue. Customers, store owners and delivery partners use the same login.</p>
        </div>

        <input
          className="login-input"
          type="email"
          autoComplete="email"
          aria-label="Email address"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError('') }}
          autoFocus
        />
        <div className="login-pw">
          <input
            className="login-input"
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            aria-label="Password"
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
          />
          <button type="button" className="login-pw-toggle" onClick={() => setShowPw((s) => !s)}>
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>
        <label className="login-remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember me on this device
          <small>Each tab keeps its own login, so you can test customer, admin and rider side by side</small>
        </label>
        {error && <p className="login-error" role="alert">{error}</p>}

        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? <span className="login-spinner" /> : 'Sign in'}
        </button>

        <div className="login-divider"><span>New to FreshMart?</span></div>
        <Link to="/register" className="login-google-btn">Create an account</Link>

        <div className="login-demo">
          <b>Demo logins</b> (after running <code>python seed.py</code>)
          <span>Customer: customer@freshmart.com / customer123</span>
          <span>Store admin: admin@freshmart.com / admin123</span>
          <span>Delivery: rider@freshmart.com / rider123</span>
          {import.meta.env.DEV && <Link to="/demo">Open demo view (all 3 apps on one screen) →</Link>}
        </div>
      </form>
    </AuthShell>
  )
}
