import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Bike, IndianRupee, User } from 'lucide-react'
import { RiderProvider } from './RiderContext.jsx'
import Home from './pages/Home.jsx'
import Earnings from './pages/Earnings.jsx'
import Profile from './pages/Profile.jsx'
import './delivery.css'

// ─────────────────────────────────────────────────────────────
//  Delivery Partner app  (/delivery/*)  — mobile first.
//  Home: online toggle, new delivery requests, active delivery with live map.
// ─────────────────────────────────────────────────────────────
export default function DeliveryApp() {
  return (
    <RiderProvider>
      <div className="rd-root">
        <div className="rd-screen">
          <Routes>
            <Route index element={<Home />} />
            <Route path="earnings" element={<Earnings />} />
            <Route path="profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/delivery" replace />} />
          </Routes>
        </div>
        <nav className="rd-tabs" aria-label="Delivery app">
          <NavLink end to="/delivery" className={({ isActive }) => (isActive ? 'on' : '')}><Bike size={22} />Deliveries</NavLink>
          <NavLink to="/delivery/earnings" className={({ isActive }) => (isActive ? 'on' : '')}><IndianRupee size={22} />Earnings</NavLink>
          <NavLink to="/delivery/profile" className={({ isActive }) => (isActive ? 'on' : '')}><User size={22} />Profile</NavLink>
        </nav>
      </div>
    </RiderProvider>
  )
}
