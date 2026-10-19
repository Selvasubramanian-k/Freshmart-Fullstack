import { useNavigate } from 'react-router-dom'
import CheckoutPage from '../components/CheckoutPage.jsx'

export default function Checkout({ cart, user, onPlaceOrder, increment, decrement }) {
  const navigate = useNavigate()
  return (
    <CheckoutPage
      cart={cart}
      user={user}
      increment={increment}
      decrement={decrement}
      onBack={() => navigate('/')}
      onPlaceOrder={async (payload) => {
        const result = await onPlaceOrder(payload)   // error vandha CheckoutPage catch pannum
        navigate('/success', { replace: true, state: { result } })
      }}
    />
  )
}
