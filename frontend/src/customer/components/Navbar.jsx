import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CATEGORIES } from '../data/categories.js'
import Icon from './Icon.jsx'
import Avatar, { AvatarPicker } from './Avatar.jsx'

// ─────────────────────────────────────────────────────────────
//  Maathanum na inga mattum maathunga
// ─────────────────────────────────────────────────────────────
const DELIVERY_ETA = '10 minutes'   // caption: "Delivery in 10 minutes"
const SEARCH_HINTS = ['milk', 'tea powder', 'tomato', 'dish wash liquid', 'ice cream', 'bread', 'eggs', 'sugar']

const ADDRESS_KEY    = 'freshmart_address'
const ADDRESS_LABELS = ['Home', 'Work', 'Other']

function readAddress() {
  try {
    const a = JSON.parse(localStorage.getItem(ADDRESS_KEY))
    if (a && ADDRESS_LABELS.includes(a.label)) return { label: a.label, text: String(a.text || '') }
  } catch { /* storage blocked / bad json */ }
  return { label: 'Home', text: '' }
}

function writeAddress(a) {
  try { localStorage.setItem(ADDRESS_KEY, JSON.stringify(a)) } catch { /* ignore */ }
}

function Navbar({ onCartClick, cartCount, onSearch, user, onLogout, onLogin, activeCat, onCategory }) {
  const [rightOpen, setRightOpen] = useState(false)
  const [query, setQuery]         = useState('')
  const [hintIdx, setHintIdx]     = useState(0)
  const [addrOpen, setAddrOpen]   = useState(false)
  const [address, setAddress]     = useState(readAddress)
  const [draft, setDraft]         = useState(address)

  const [compact, setCompact] = useState(false)
  const stripRef = useRef(null)
  const headerRef = useRef(null)

  const navigate = useNavigate()
  const location = useLocation()
  const isHome   = location.pathname === '/'

  // Mobile: keela scroll panna top part (logo/search) maraiyum, mela scroll panna thirumba varum.
  // Layout maathama transform mattum use panrom -> lag illa. rAF la throttle.
  useEffect(() => {
    let last = window.scrollY
    let ticking = false
    const measure = () => {
      const h = headerRef.current
      const strip = stripRef.current
      if (!h || !strip) return
      h.style.setProperty('--hide-y', `${Math.max(0, h.offsetHeight - strip.offsetHeight)}px`)
    }
    const update = () => {
      ticking = false
      const y = window.scrollY
      if (Math.abs(y - last) < 8) return
      const next = y > 90 && y > last
      setCompact((c) => (c === next ? c : next))
      last = y
    }
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update) }
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
    }
  }, [])

  // select panna category strip la theriyura madhiri scroll aagum
  useEffect(() => {
    const el = stripRef.current?.querySelector('.zn-cat.active')
    el?.scrollIntoView?.({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [activeCat])

  // Search box la text thaanaave maaruthu (Zepto maathiri)
  useEffect(() => {
    const t = setInterval(() => setHintIdx((i) => (i + 1) % SEARCH_HINTS.length), 2600)
    return () => clearInterval(t)
  }, [])

  const goTo = (path) => {
    setRightOpen(false)
    navigate(path)
  }

  const handleLogout = () => {
    setRightOpen(false)
    onLogout()
  }

  const handleSearch = (value) => {
    setQuery(value)
    onSearch(value)
    if (!isHome) navigate('/')          // vera page la type panna Home ku povom
  }

  const openAddress = () => { setDraft(address); setAddrOpen(true) }
  const closeAddress = () => setAddrOpen(false)
  const saveAddress = (e) => {
    e.preventDefault()
    const next = { label: draft.label, text: draft.text.trim() }
    setAddress(next)
    writeAddress(next)
    setAddrOpen(false)
  }

  return (
    <>
      <header ref={headerRef} className={`zn-header ${compact ? 'is-compact' : ''}`}>
        <div className="zn-top">

          <button type="button" className="zn-logo" aria-label="FreshMart home" onClick={() => navigate('/')}>
            <svg width="38" height="38" viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#00a870"/><path d="M13 16h14l-2 13H15L13 16z" fill="white"/><path d="M17 16v-3a3 3 0 0 1 6 0v3" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>
            <span>FreshMart</span>
          </button>

          {/* Delivery caption + address */}
          <div className="zn-deliver">
            <button
              type="button"
              className="zn-deliver-btn"
              aria-haspopup="dialog"
              aria-expanded={addrOpen}
              onClick={openAddress}
            >
              <span className="zn-eta"><Icon name="zap" /> <span className="zn-eta-pre">Delivery in</span> {DELIVERY_ETA}</span>
              <span className="zn-addr">
                <span className="zn-addr-text">{address.label} · {address.text || 'Add address'}</span>
                <span className="zn-caret" aria-hidden="true">▾</span>
              </span>
            </button>

            {addrOpen && (
              <>
                <div className="zn-pop-backdrop" onClick={closeAddress} />
                <form
                  className="zn-pop"
                  role="dialog"
                  aria-label="Delivery address"
                  onSubmit={saveAddress}
                  onKeyDown={(e) => { if (e.key === 'Escape') closeAddress() }}
                >
                  <div className="zn-pop-head">
                    <span>Delivery location</span>
                    <button type="button" className="zn-pop-close" aria-label="Close" onClick={closeAddress}><Icon name="x" /></button>
                  </div>

                  <div className="zn-chips" role="group" aria-label="Address type">
                    {ADDRESS_LABELS.map((l) => (
                      <button
                        key={l}
                        type="button"
                        className={`zn-chip ${draft.label === l ? 'active' : ''}`}
                        aria-pressed={draft.label === l}
                        onClick={() => setDraft((d) => ({ ...d, label: l }))}
                      >
                        {l}
                      </button>
                    ))}
                  </div>

                  <input
                    className="zn-pop-input"
                    type="text"
                    aria-label="Address"
                    placeholder="House no, street, area"
                    value={draft.text}
                    onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                    autoFocus
                  />
                  <button type="submit" className="zn-pop-save" disabled={!draft.text.trim()}>Save address</button>
                </form>
              </>
            )}
          </div>

          {/* Search with rotating hint */}
          <div className="zn-search">
            <span className="zn-search-icon" aria-hidden="true"><Icon name="search" /></span>
            <div className="zn-search-field">
              <input
                type="text"
                aria-label="Search products"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {query === '' && (
                <span className="zn-ph" aria-hidden="true">
                  Search for "<b key={hintIdx} className="zn-ph-word">{SEARCH_HINTS[hintIdx]}</b>"
                </span>
              )}
            </div>
          </div>

          <div className="zn-actions">
            {user ? (
              <button type="button" className="zn-account" aria-label="My account" onClick={() => navigate('/account')}>
                <Avatar user={user} size={36} />
              </button>
            ) : (
              <button type="button" className="zn-login" onClick={onLogin}>Log in</button>
            )}
            <button type="button" className="zn-cart" aria-label={`Cart, ${cartCount} items`} onClick={onCartClick}>
              <Icon name="shopping-cart" />
              {cartCount > 0 && <span className="zn-cart-badge">{cartCount}</span>}
            </button>
            <button type="button" className="zn-menu" aria-label="Menu" onClick={() => setRightOpen(true)}><Icon name="ellipsis-vertical" /></button>
          </div>
        </div>

        {/* Category icon strip (Home page la mattum) */}
        {isHome && (
          <nav className="zn-strip" aria-label="Categories" ref={stripRef}>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`zn-cat ${activeCat === c.id ? 'active' : ''}`}
                aria-current={activeCat === c.id ? 'true' : undefined}
                onClick={() => onCategory(c.id)}
              >
                <span className="zn-cat-icon" aria-hidden="true"><Icon name={c.icon} id={c.id} /></span>
                {c.badge && <span className="zn-cat-badge">{c.badge}</span>}
                <span className="zn-cat-label">{c.label}</span>
              </button>
            ))}
          </nav>
        )}
      </header>

      {rightOpen && <div className="right-drawer-backdrop" onClick={() => setRightOpen(false)} />}

      <div className={`right-drawer ${rightOpen ? 'open' : ''}`}>
        <div className="right-drawer-header">
          <span>Menu</span>
          <button onClick={() => setRightOpen(false)}><Icon name="x" /></button>
        </div>

        <a className="right-nav-link" onClick={() => goTo('/shops')}><Icon name="store" /> Shops</a>
        <a className="right-nav-link" onClick={() => goTo('/offers')}><Icon name="gift" /> Offers</a>
        <a className="right-nav-link" onClick={() => goTo('/contact')}><Icon name="phone" /> Contact</a>

        {/* Account in drawer */}
        {user ? <>
          <div className="right-drawer-account" onClick={() => goTo('/account')} style={{ cursor: 'pointer' }}>
            <Avatar user={user} size={40} />
            <div>
              <p className="right-account-name">{user.name || 'My account'}</p>
              <p className="right-account-email">{user.email || `+91 ${user.phone}`}</p>
            </div>
          </div>
          <div className="right-drawer-avatar"><p>Profile picture</p><AvatarPicker user={user} compact /></div>
          <div className="right-drawer-btns">
            <button className="btn-logout" onClick={handleLogout}><Icon name="log-out" /> Logout</button>
          </div>
        </> : (
          <div className="right-drawer-btns">
            <button className="zn-login wide" onClick={() => { setRightOpen(false); onLogin() }}>Log in with mobile</button>
          </div>
        )}
        <a className="right-nav-link" href="/partner" style={{ fontSize: 13 }}>Partner login (store, delivery, staff)</a>
      </div>
    </>
  )
}

export default Navbar
