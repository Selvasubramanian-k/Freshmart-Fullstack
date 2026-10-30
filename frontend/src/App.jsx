import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './shared/context/AuthContext.jsx'
import RequireRole from './shared/components/RequireRole.jsx'
import Login from './shared/pages/Login.jsx'
import Welcome from './shared/pages/Welcome.jsx'
import FullPageLoader from './shared/components/FullPageLoader.jsx'

// Each role app loads separately (customer download panna admin code varaadhu)
const CustomerApp = lazy(() => import('./customer/CustomerApp.jsx'))
const AdminApp    = lazy(() => import('./admin/AdminApp.jsx'))
const DeliveryApp = lazy(() => import('./delivery/DeliveryApp.jsx'))
const OwnerApp    = lazy(() => import('./owner/OwnerApp.jsx'))
const PickerApp   = lazy(() => import('./picker/PickerApp.jsx'))
const SupportApp  = lazy(() => import('./support/SupportApp.jsx'))
// Demo view: customer + admin + rider on one screen. Only in `npm run dev` (not in the Vercel build).
// /demo: always in dev; on Netlify only if VITE_ENABLE_DEMO=true
const DEMO_ON = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === 'true'
const DemoView  = DEMO_ON ? lazy(() => import('./demo/DemoView.jsx')) : null
const DemoLogin = DEMO_ON ? lazy(() => import('./demo/DemoLogin.jsx')) : null

// ─────────────────────────────────────────────────────────────
//  Root router.  /login -> everyone: mobile -> OTP -> /welcome -> role home
//                (store owners & delivery partners are added by the owner / store admin, no sign-up page)
//                /admin/*           -> Store admin (shop owner) dashboard
//                /delivery/*        -> Delivery partner app
//                /owner/*           -> FreshMart owner (super admin): all stores, commission, areas, offers
//                /picker            -> store picker / packer app
//                /support           -> support / operations inbox (support team + owner)
//                /*                 -> Customer shop
//  Future roles (delivery, super admin, picker, support) inga oru line add panna podhum.
// ─────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/join/*" element={<Navigate to="/login" replace />} />
        <Route path="/welcome" element={<Welcome />} />
        {DemoView && <Route path="/demo" element={<DemoView />} />}
        {DemoLogin && <Route path="/demo/as/:role" element={<DemoLogin />} />}
        <Route path="/admin/*" element={<RequireRole role="admin"><AdminApp /></RequireRole>} />
        <Route path="/delivery/*" element={<RequireRole role="delivery"><DeliveryApp /></RequireRole>} />
        <Route path="/owner/*" element={<RequireRole role="superadmin"><OwnerApp /></RequireRole>} />
        <Route path="/picker/*" element={<RequireRole role="picker"><PickerApp /></RequireRole>} />
        <Route path="/support/*" element={<RequireRole role={['support', 'superadmin']}><SupportApp /></RequireRole>} />
        <Route path="/*" element={<RequireRole role="customer"><CustomerApp /></RequireRole>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </AuthProvider>
  )
}
