import { useNavigate } from 'react-router-dom'
import CheckoutPage from '../components/CheckoutPage.jsx'

// Scooter animation kanna theriyura maadhiri minimum 1.2s kaattum (error vandha udane nirkum)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

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
        const [result] = await Promise.all([onPlaceOrder(payload), wait(1200)])   // error vandha CheckoutPage catch pannum
        navigate('/success', { replace: true, state: { result } })
      }}
    />
  )
}
