import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { homeFor } from '../utils/roles.js'
import FullPageLoader from './FullPageLoader.jsx'

// Login aagala -> /login.  Vera role -> avanga own dashboard ku redirect.
// role: 'admin' or a list ['support', 'superadmin']
export default function RequireRole({ role, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!(Array.isArray(role) ? role : [role]).includes(user.role)) return <Navigate to={homeFor(user.role)} replace />
  return children
}
