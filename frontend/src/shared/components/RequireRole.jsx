import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { homeFor } from '../utils/roles.js'
import FullPageLoader from './FullPageLoader.jsx'

// Login aagala -> customer pages: shop (login sheet there) · staff pages: /partner.  Vera role -> avanga own home.
// role: 'admin' or a list ['support', 'superadmin']
export default function RequireRole({ role, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to={(Array.isArray(role) ? role : [role]).includes('customer') ? '/' : '/partner'} replace state={{ from: location.pathname }} />
  if (!(Array.isArray(role) ? role : [role]).includes(user.role)) return <Navigate to={homeFor(user.role)} replace />
  return children
}
