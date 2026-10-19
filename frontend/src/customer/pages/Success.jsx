import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import OrderSuccess from '../components/OrderSuccess.jsx'

export default function Success() {
  const navigate = useNavigate()
  const location = useLocation()
  const result   = location.state?.result

  if (!result) return <Navigate to="/" replace />

  return (
    <OrderSuccess
      result={result}
      onBack={() => navigate('/')}
      onTrack={() => navigate('/account')}
    />
  )
}
