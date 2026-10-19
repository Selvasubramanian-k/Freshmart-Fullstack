// ─────────────────────────────────────────────────────────────
//  RECOMMENDATION ENGINE  (frontend only, no backend)
//
//  1. Time based      -> morning / afternoon / evening / night
//  2. Weather based   -> hot / rainy / cool
//  3. Personal        -> cart items + previous orders
//
//  Rules ellam product ID lists. Maatha venumna inga ids mathunga.
//  (IDs -> src/data/products.js)
// ─────────────────────────────────────────────────────────────
import { getProduct, PRODUCTS } from '../data/products.js'

// ── 1. TIME ──────────────────────────────────────────────────
export function getTimeSlot(date = new Date()) {
  const h = date.getHours()
  if (h >= 5  && h < 11) return 'morning'
  if (h >= 11 && h < 16) return 'afternoon'
  if (h >= 16 && h < 19) return 'evening'
  return 'night'
}

export const SLOT_META = {
  morning:   { greeting: 'Good Morning',   icon: 'sunrise', reason: 'Great for breakfast' },
  afternoon: { greeting: 'Good Afternoon', icon: 'sun', reason: 'For lunch & cooking' },
  evening:   { greeting: 'Good Evening',   icon: 'sunset', reason: 'Perfect evening snack' },
  night:     { greeting: 'Good Night',     icon: 'moon', reason: 'For dinner & tomorrow' },
}

// Earlier in list = higher priority
const TIME_RULES = {
  // Milk, Bread, Rusk, Tea, Coffee, Batter, Egg, Oats, Marie, Butter, Banana
  morning:   [22, 35, 36, 29, 30, 39, 26, 37, 38, 23, 2],
  // Rice, Dal, Oil, Salt, Buttermilk, Curd, Onion, Potato, Tomato, Carrot, Fish, Chicken
  afternoon: [41, 43, 42, 44, 32, 25, 47, 7, 8, 5, 10, 11],
  // Tea, Coffee, Lays, Bingo, Mixture, Cookies, Marie, Rusk, Soft drink
  evening:   [29, 30, 14, 15, 51, 17, 38, 36, 16],
  // Milk, Curd, Egg, Bread, Batter, Paneer, Chicken, Fish, Choco Milk
  night:     [22, 25, 26, 35, 39, 46, 11, 10, 28],
}

// ── 2. WEATHER ───────────────────────────────────────────────
const RAIN_CODES = new Set([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99,
])

export const HOT_TEMP  = 30   // °C and above  -> hot
export const COOL_TEMP = 24   // °C and below  -> cool

export function classifyWeather(weather) {
  if (!weather || typeof weather.temp !== 'number') return null
  if (RAIN_CODES.has(weather.code)) return 'rainy'
  if (weather.temp >= HOT_TEMP)     return 'hot'
  if (weather.temp <= COOL_TEMP)    return 'cool'
  return 'mild'
}

export const WEATHER_META = {
  hot:   { icon: 'thermometer-sun', label: 'Hot',   reason: 'Beat the heat' },
  rainy: { icon: 'cloud-rain', label: 'Rainy', reason: 'Perfect for rainy weather' },
  cool:  { icon: 'snowflake', label: 'Cool',  reason: 'Warm up with this' },
  mild:  { icon: 'cloud-sun', label: 'Mild',  reason: '' },
}

const WEATHER_RULES = {
  // Tender Coconut, Buttermilk, Soft Drinks, Mango Juice, Lemon Soda, Ice Cream, Watermelon, Lemon, Curd
  hot:   [31, 32, 16, 27, 33, 50, 48, 49, 25],
  // Tea, Coffee, Mixture, Bingo, Lays, Hot Chocolate, Cookies
  rainy: [29, 30, 51, 15, 14, 34, 17],
  // Tea, Coffee, Hot Chocolate, Choco Milk, Cookies, Marie, Rusk, Mixture
  cool:  [29, 30, 34, 28, 17, 38, 36, 51],
  mild:  [],
}

// ── 3. PERSONAL: frequently bought together ──────────────────
//  key = product id, value = suggestions (first = best match)
const ASSOCIATIONS = {
  22: [40, 29, 30, 35, 36, 38],      // Milk        -> Sugar, Tea Powder, Coffee Powder, Bread...
  29: [22, 40, 38, 36],              // Tea Powder  -> Milk, Sugar, Marie, Rusk
  30: [22, 40, 38],                  // Coffee      -> Milk, Sugar, Marie
  40: [29, 30, 22],                  // Sugar       -> Tea, Coffee, Milk
  35: [23, 22, 26, 36],              // Bread       -> Butter, Milk, Egg
  23: [35, 36],                      // Butter      -> Bread, Rusk
  26: [35, 47, 42],                  // Egg         -> Bread, Onion, Oil
  25: [41, 32, 47],                  // Curd        -> Rice, Buttermilk, Onion
  39: [47, 8, 44],                   // Batter      -> Onion, Tomato, Salt
  41: [43, 42, 44, 47],              // Rice        -> Dal, Oil, Salt, Onion
  43: [41, 42, 44, 47],              // Dal         -> Rice, Oil, Salt, Onion
  42: [41, 43, 44],                  // Oil         -> Rice, Dal, Salt
  44: [42, 41, 43],                  // Salt
  10: [47, 8, 49, 42],               // Fish        -> Onion, Tomato, Lemon, Oil
  11: [47, 8, 42, 49],               // Chicken     -> Onion, Tomato, Oil, Lemon
  13: [47, 8, 42, 44],               // Mutton
  12: [47, 8, 42],                   // Chicken Liver
  7:  [47, 8, 5],                    // Potato      -> Onion, Tomato, Carrot
  8:  [47, 7, 5, 9],                 // Tomato
  47: [8, 7, 5],                     // Onion
  5:  [6, 7, 47],                    // Carrot
  14: [16, 15, 51],                  // Lays        -> Soft Drinks, Bingo, Mixture
  15: [16, 14, 51],
  16: [14, 15, 17],
  17: [22, 29, 30],                  // Cookies     -> Milk, Tea, Coffee
  38: [29, 30, 22],                  // Marie       -> Tea, Coffee, Milk
  36: [29, 30, 22],                  // Rusk
  37: [22, 2, 45],                   // Oats        -> Milk, Banana, Jaggery
  18: [19, 20, 21],                  // Dog Food    -> Pet Biscuits, Shampoo, Collar
  19: [18, 20],
  20: [21, 18],
  21: [18, 19],
  50: [17, 28],                      // Ice Cream
  28: [17, 38],                      // Choco Milk
  52: [53, 54],                      // Detergent   -> Dishwash, Floor Cleaner
  53: [52, 54],
  54: [52, 53],
}

// ── AUTO SUGGESTIONS (ellaa products ku) ─────────────────────
//  ASSOCIATIONS la illaadha product (pudhu products ellam) ku:
//  1) same category popular items  2) complementary categories
const COMPLEMENT = {
  fruits:    ['cooking', 'dairy', 'meat'],
  meat:      ['fruits', 'cooking', 'beverage'],
  snacks:    ['beverage', 'dairy', 'breakfast'],
  dairy:     ['breakfast', 'beverage', 'fruits'],
  beverage:  ['snacks', 'breakfast', 'dairy'],
  breakfast: ['dairy', 'beverage', 'fruits'],
  cooking:   ['fruits', 'meat', 'dairy'],
  home:      ['petcare', 'cooking'],
  petcare:   ['home', 'dairy'],
}
const TAG_RANK = { popular: 0, sale: 1, new: 2, organic: 3 }
const byRank = (a, b) => (TAG_RANK[a.tag] ?? 4) - (TAG_RANK[b.tag] ?? 4) || a.id - b.id

// Name based pairs: product name la intha word irundha -> intha words ulla products mudhalla varum
const NAME_PAIRS = [
  [/jam|spread|honey|peanut butter/i,        [/bread/i, /butter(?!milk)/i, /rusk/i, /milk/i]],
  [/bread|bun|rusk/i,                         [/jam/i, /butter(?!milk)/i, /egg/i, /milk/i]],
  [/poha|upma|rava|oats|muesli|cornflake/i,   [/milk/i, /banana/i, /honey/i, /tea|coffee/i]],
  [/tea|coffee/i,                             [/milk/i, /sugar/i, /biscuit|rusk|cookie/i]],
  [/biscuit|cookie|cracker/i,                 [/tea|coffee/i, /milk/i]],
  [/chips|wafer|puffs|chikki|murukku|popcorn|mixture/i, [/cola|soda|drink|juice/i, /chocolate/i]],
  [/cola|soda|juice|drink/i,                  [/chips|wafer|puffs|popcorn/i, /biscuit|cookie/i]],
  [/rice|dal|atta|flour|rava/i,               [/oil/i, /salt/i, /masala|powder|seeds/i, /onion/i]],
  [/masala|powder|seeds|tamarind/i,           [/oil/i, /onion/i, /tomato/i, /rice|dal/i]],
  [/chicken|mutton|fish|prawn|crab|squid|sardine/i, [/onion/i, /tomato/i, /lemon/i, /masala|chilli|turmeric/i, /oil/i]],
  [/milk|curd|lassi|yogurt|yoghurt/i,         [/sugar/i, /tea|coffee/i, /bread/i, /cereal|oats|muesli/i]],
  [/cheese|paneer/i,                          [/bread/i, /tomato/i, /capsicum/i]],
  [/chocolate|ice ?cream/i,                   [/milk/i, /biscuit|cookie/i]],
  [/cleaner|detergent|wash|phenyl|scrub|tissue|garbage/i, [/cleaner|detergent|wash|phenyl|scrub|tissue|garbage/i]],
  [/dog|cat|pet|bird|fish food|leash|bone/i,  [/dog|cat|pet|bird|leash|bone|litter/i]],
]

const autoCache = new Map()
export function relatedIds(id) {
  const manual = ASSOCIATIONS[id]
  if (manual) return manual
  if (autoCache.has(id)) return autoCache.get(id)
  const p = getProduct(id)
  let out = []
  if (p) {
    // same category: id ku nerukkamaana neighbours + popular, so every product ku different list
    const same = PRODUCTS.filter(x => x.cat === p.cat && x.id !== p.id)
    const near = same.slice().sort((a, b) => Math.abs(a.id - p.id) - Math.abs(b.id - p.id)).slice(0, 2)
    const pop  = same.filter(x => !near.includes(x)).sort(byRank).slice(0, 2)
    const other = (COMPLEMENT[p.cat] || []).flatMap(c => PRODUCTS.filter(x => x.cat === c).sort(byRank).slice(0, 1))
    // name based pairs (jam -> bread, butter ...)
    const paired = []
    for (const [re, wants] of NAME_PAIRS) {
      if (!re.test(p.name)) continue
      for (const w of wants) {
        const hit = PRODUCTS.find(x => x.id !== p.id && w.test(x.name) && !paired.includes(x))
        if (hit) paired.push(hit)
      }
      break
    }
    const seen = new Set()
    out = [...paired, ...near, ...other, ...pop].filter(x => !seen.has(x.id) && seen.add(x.id)).map(x => x.id)
  }
  autoCache.set(id, out)
  return out
}

// ── helpers ──────────────────────────────────────────────────
const inCart = (cart) => (id) => (cart?.[id] || 0) > 0

function pickProducts(scored, limit) {
  return [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ product, reason }) => ({ product, reason }))
}

function addScore(map, id, score, reason) {
  const product = getProduct(id)
  if (!product) return
  const cur = map.get(product.id)
  if (!cur) map.set(product.id, { product, score, reason, best: score })
  else {
    cur.score += score
    // reason = highest-scoring signal
    if (score > cur.best) { cur.best = score; cur.reason = reason }
  }
}

// ── TIME + WEATHER ───────────────────────────────────────────
export function getContextRecommendations({ slot, weatherKind, cart = {}, orders = [], limit = 8 }) {
  const scored = new Map()
  const slotMeta    = SLOT_META[slot]
  const weatherMeta = WEATHER_META[weatherKind]

  ;(TIME_RULES[slot] || []).forEach((id, i) => {
    addScore(scored, id, 3 - i * 0.1, slotMeta.reason)
  })
  // Weather gets higher weight than time -> hot day la cool drinks mela varum
  ;(WEATHER_RULES[weatherKind] || []).forEach((id, i) => {
    addScore(scored, id, 4 - i * 0.1, weatherMeta.reason)
  })

  // small boost for things the user bought before
  const freq = orderFrequency(orders)
  for (const [id, count] of freq) {
    if (scored.has(id)) scored.get(id).score += Math.min(count, 4) * 0.4
  }

  for (const id of [...scored.keys()]) if (inCart(cart)(id)) scored.delete(id)
  return pickProducts(scored, limit)
}

// ── PERSONAL ─────────────────────────────────────────────────
export function orderFrequency(orders = []) {
  const freq = new Map()
  for (const order of orders) {
    for (const [id, qty] of order.items || []) {
      const key = Number(id)
      freq.set(key, (freq.get(key) || 0) + (qty > 0 ? 1 : 0))
    }
  }
  return freq
}

// Cart la irukkura items based -> "Milk add panna Sugar / Tea / Coffee"
export function getCartRelated(cart = {}, limit = 6) {
  const scored = new Map()
  const cartIds = Object.keys(cart).filter(id => cart[id] > 0).map(Number)

  cartIds.forEach((cid) => {
    const list = relatedIds(cid)
    const base = getProduct(cid)?.name
    list.forEach((id, i) => {
      if (inCart(cart)(id)) return
      addScore(scored, id, (list.length - i) + 1, `Goes well with ${base}`)
    })
  })
  return pickProducts(scored, limit)
}

// Previous orders based -> "Munnadi Milk vaangi irukinga -> Tea Powder"
export function getHistoryRelated(orders = [], cart = {}, limit = 6) {
  const scored = new Map()
  const freq   = orderFrequency(orders)

  // newest order first -> recent habits ku weight
  orders.slice().reverse().forEach((order, orderIdx) => {
    const recency = Math.max(1, 3 - orderIdx * 0.5)
    for (const [rawId] of order.items || []) {
      const oid  = Number(rawId)
      const base = getProduct(oid)?.name
      const list = relatedIds(oid)
      list.forEach((id, i) => {
        if (inCart(cart)(id)) return
        addScore(scored, id, ((list.length - i) + 1) * recency, `Because you ordered ${base}`)
      })
    }
  })

  // already vaangina items inga vendaam -> "Buy again" section la varum
  for (const id of [...scored.keys()]) {
    if (freq.has(id)) scored.delete(id)
  }
  return pickProducts(scored, limit)
}

// Buy again -> user adikadi vaangura items
export function getBuyAgain(orders = [], cart = {}, limit = 6) {
  const freq = orderFrequency(orders)
  return [...freq.entries()]
    .filter(([id]) => getProduct(id) && !inCart(cart)(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, n]) => ({
      product: getProduct(id),
      reason: n > 1 ? `You ordered this ${n} times` : 'Order again',
    }))
}

// All personal signals mix panni, duplicate illama oru list
export function getPersonalRecommendations({ cart = {}, orders = [], limit = 8 }) {
  const out  = []
  const seen = new Set()
  const push = (list, cap = limit) => {
    for (const item of list) {
      if (out.length >= cap) return
      if (seen.has(item.product.id)) continue
      seen.add(item.product.id)
      out.push(item)
    }
  }

  // Cart la item irundha -> cart ku related items MATTUM (jam ku petcare varaadhu)
  const hasCart = Object.values(cart).some(q => q > 0)
  if (hasCart) {
    push(getCartRelated(cart, limit), limit)
    return out
  }

  // Cart empty -> previous orders based
  const buyAgain = getBuyAgain(orders, cart, limit)
  const reserve  = Math.min(2, buyAgain.length)
  push(getHistoryRelated(orders, cart, limit), limit - reserve)
  push(buyAgain, limit)
  return out
}
