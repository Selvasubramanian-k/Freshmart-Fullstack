import { useState, useEffect, useMemo } from 'react'
import Banner          from '../components/Banner.jsx'
import ProductList     from '../components/ProductList.jsx'
import Recommendations from '../components/Recommendations.jsx'
import FeaturedRows    from '../components/FeaturedRows.jsx'
import CategorySections from '../components/CategorySection.jsx'
import useWeather      from '../hooks/useWeather.js'
import {
  getTimeSlot, classifyWeather, SLOT_META, WEATHER_META,
  getContextRecommendations, getPersonalRecommendations,
} from '../utils/recommend.js'
import Icon from '../components/Icon.jsx'

// "selva kumar" -> "Selva"   (Guest / name illaina name kaattaadhu)
function firstName(user) {
  const n = (user?.name || '').trim().split(/\s+/)[0]
  if (!n || /^(guest|google)$/i.test(n)) return ''
  return n.charAt(0).toUpperCase() + n.slice(1)
}

export default function Home({ activeCat, onCategory, searchQuery, orders = [], user, ...cartProps }) {
  const { cart } = cartProps

  // time -> 5 min once refresh (morning -> afternoon mari mathirum)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const weather     = useWeather()
  const slot        = getTimeSlot(now)
  const weatherKind = classifyWeather(weather)
  const slotMeta    = SLOT_META[slot]
  const weatherMeta = weatherKind ? WEATHER_META[weatherKind] : null
  const name        = firstName(user)

  // Personal: cart + previous orders
  const personal = useMemo(
    () => getPersonalRecommendations({ cart, orders, limit: 8 }),
    [cart, orders]
  )

  // Time + weather (personal la vandha items dup aagama)
  const context = useMemo(() => {
    const personalIds = new Set(personal.map(i => i.product.id))
    return getContextRecommendations({ slot, weatherKind, cart, orders, limit: 12 })
      .filter(i => !personalIds.has(i.product.id))
      .slice(0, 8)
  }, [slot, weatherKind, cart, orders, personal])

  const hasCart = Object.values(cart).some(q => q > 0)
  const showReco = activeCat === 'all' && searchQuery === ''

  const weatherText = weather && weatherMeta
    ? <><Icon name={weatherMeta.icon} /> {Math.round(weather.temp)}°C · {weatherMeta.label} weather</>
    : null

  return (
    <>
      <Banner onCategory={onCategory} />

      {showReco && (
        <>
          <Recommendations
            title={<><Icon name="sparkles" /> {hasCart ? 'You may also need' : 'Recommended for you'}</>}
            subtitle={hasCart ? 'Based on items in your cart' : 'Based on your previous orders'}
            items={personal}
            {...cartProps}
          />
          <Recommendations
            title={<><Icon name={slotMeta.icon} /> {slotMeta.greeting}{name ? ' ' + name : ''}!!!</>}
            subtitle={<>Picked for this time of day{weatherText && <> · {weatherText}</>}</>}
            items={context}
            {...cartProps}
          />
        </>
      )}

      {showReco ? (
        <>
          <FeaturedRows {...cartProps} />
          <CategorySections onCategory={onCategory} {...cartProps} />
        </>
      ) : (
        <ProductList activeCat={activeCat} searchQuery={searchQuery} cart={cart} {...cartProps} />
      )}
    </>
  )
}
