import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { homeFor } from '../utils/roles.js'
import AuthLayout from '../auth/AuthLayout.jsx'
import PhoneOtp from '../auth/PhoneOtp.jsx'
import StatusScreen from '../auth/StatusScreen.jsx'
import '../auth/auth.css'

// ─────────────────────────────────────────────────────────────
//  Ore URL, ore login page ellaa role kum: mobile -> OTP. Vera edhuvum ketka maattom.
//    customer number   -> /welcome -> shop   (pudhu number na udane customer account)
//    store admin       -> /welcome -> dashboard   (FreshMart owner panel la "Add store")
//    owner (SUPER_ADMIN_PHONES) -> /owner · picker -> /picker · support -> /support
//    delivery partner  -> /welcome -> delivery app (store admin Staff page la add pannuvaar)
//    old pending / rejected request -> status page
// ─────────────────────────────────────────────────────────────
const DEMO_NUMBERS = [['Customer', '9123456780'], ['Store admin', '9876543210'], ['Delivery', '9840098400']]

export default function Login() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [devMode, setDev]     = useState(false)
  const [status, setStatus]   = useState(null)       // verify reply for an old pending / rejected request
  const [leaving, setLeaving] = useState(false)      // just logged in -> going to /welcome (skip the old redirect)

  useEffect(() => { api.get('/api/auth/otp/config').then((c) => setDev(Boolean(c.dev_mode))).catch(() => {}) }, [])

  if (!loading && user && !leaving) return <Navigate to={homeFor(user.role)} replace />

  const onVerified = (res) => {
    if (res.status !== 'ok') { setStatus(res); return }
    setLeaving(true)
    signIn(res)
    navigate('/welcome', { replace: true, state: { fresh: true, isNew: Boolean(res.is_new) } })
  }

  return (
    <AuthLayout login>
      {status
        ? <StatusScreen {...status} onBack={() => setStatus(null)} />
        : <PhoneOtp
            kicker="வணக்கம்!"
            title="Log in to FreshMart"
            sub="Enter your mobile number. We’ll send a 6-digit code."
            demos={devMode ? DEMO_NUMBERS : []}
            note="New here? Just enter your number. Store owners and delivery partners log in here too."
            onVerified={onVerified} />}
    </AuthLayout>
  )
}
