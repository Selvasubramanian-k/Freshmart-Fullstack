import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './shared/context/AuthContext.jsx'
import RequireRole from './shared/components/RequireRole.jsx'
import Login from './shared/pages/Login.jsx'
import Register from './shared/pages/Register.jsx'
import FullPageLoader from './shared/components/FullPageLoader.jsx'

// Each role app loads separately (customer download panna admin code varaadhu)
const CustomerApp = lazy(() => import('./customer/CustomerApp.jsx'))
const AdminApp    = lazy(() => import('./admin/AdminApp.jsx'))
const DeliveryApp = lazy(() => import('./delivery/DeliveryApp.jsx'))

// ─────────────────────────────────────────────────────────────
//  Root router.  /login + /register -> everyone (ore login, role based redirect)
//                /admin/*           -> Store admin (shop owner) dashboard
//                /delivery/*        -> Delivery partner app
//                /*                 -> Customer shop
//  Future roles (delivery, super admin, picker, support) inga oru line add panna podhum.
// ─────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin/*" element={<RequireRole role="admin"><AdminApp /></RequireRole>} />
        <Route path="/delivery/*" element={<RequireRole role="delivery"><DeliveryApp /></RequireRole>} />
        <Route path="/*" element={<RequireRole role="customer"><CustomerApp /></RequireRole>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </AuthProvider>
  )
}
