import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../shared/context/AuthContext.jsx'
import { homeFor } from '../shared/utils/roles.js'
import { DEMO_USERS } from './demoApi.js'

// /demo/as/:role -> demo frame la andha role ku auto login (dev only)
export default function DemoLogin() {
  const { role } = useParams()
  const [params] = useSearchParams()
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    if (loading) return
    const creds = DEMO_USERS[role]
    if (!creds) return
    const go = (u) => navigate(params.get('next') || homeFor(u.role), { replace: true })
    if (user?.role === role) { go(user); return }
    // a different demo user in this frame is simply replaced by the new login
    login(creds.email, creds.password, false).then(go).catch((e) => setError(`${e.message}. Did you run python seed.py?`))
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!DEMO_USERS[role]) return <div style={{ padding: 24, color: '#b91c1c' }}>Unknown role: {role}</div>
  return <div style={{ padding: 24, fontFamily: 'Montserrat, sans-serif', color: error ? '#b91c1c' : '#5b6472' }}>{error || 'Signing in…'}</div>
}
