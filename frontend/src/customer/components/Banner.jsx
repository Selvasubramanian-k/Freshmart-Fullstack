import Egg from '../../assets/dairy.webp'
import cool from '../../assets/soft-drinks.webp'
import fruits from '../../assets/fruits.webp'
import { useState, useEffect } from 'react'

// cat -> button click panna Home la entha category open aagum (categories.js la irukkura id)
const BANNERS = [
  { id:1, tag:'FRESH TODAY', title:'Fresh Fruits & Veggies', sub:'Farm-fresh picks, up to 30% off',           cta:'Shop Fruits',  cat:'fruits',   img:fruits },
  { id:2, tag:'FREE DELIVERY', title:'Dairy & Eggs',         sub:'Milk, curd, eggs & more. Free delivery over ₹200', cta:'Shop Dairy',   cat:'dairy',    img:Egg },
  { id:3, tag:'NEW ARRIVALS', title:'Snacks & Drinks',       sub:'Chips, cold drinks & munchies, new every week',   cta:'Shop Snacks',  cat:'snacks',   img:cool },
]

function Banner({ onCategory }) {
  const [cur, setCur] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setCur(c => (c + 1) % 3), 3000)
    return () => clearInterval(t)
  }, [])

  const go = (cat) => {
    if (onCategory) onCategory(cat)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const Content = ({ b }) => (
    <div className="banner-content">
      <span className="banner-tag">{b.tag}</span>
      <h3>{b.title}</h3>
      <p>{b.sub}</p>
      <button type="button" className="banner-btn" onClick={(e) => { e.stopPropagation(); go(b.cat) }}>{b.cta} →</button>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <div className="banner-desktop">
        {BANNERS.map(b => (
          <div key={b.id} className="banner-card" style={{ backgroundImage:`url(${b.img})` }} onClick={() => go(b.cat)}>
            <div className="banner-overlay" />
            <Content b={b} />
          </div>
        ))}
      </div>

      {/* Mobile Carousel */}
      <div className="banner-carousel">
        <div className="carousel-track" style={{ transform:`translateX(-${cur * 100}%)` }}>
          {BANNERS.map(b => (
            <div key={b.id} className="banner-card carousel-slide" style={{ backgroundImage:`url(${b.img})` }} onClick={() => go(b.cat)}>
              <div className="banner-overlay" />
              <Content b={b} />
            </div>
          ))}
        </div>
        <button className="c-btn c-left" onClick={() => setCur(c => (c - 1 + 3) % 3)}>‹</button>
        <button className="c-btn c-right" onClick={() => setCur(c => (c + 1) % 3)}>›</button>
        <div className="c-dots">
          {BANNERS.map((_, i) => (
            <span key={i} className={`c-dot ${cur === i ? 'active' : ''}`} onClick={() => setCur(i)} />
          ))}
        </div>
      </div>
    </>
  )
}

export default Banner
