// ─────────────────────────────────────────────────────────────
//  Product catalog -> ippo backend (MongoDB) la irundhu varum.
//  Pudhu product add panna: Store admin dashboard -> Products -> Add product.
//  (Pazhaya static list ippo backend/seed_data/products.json la irukku; `python seed.py` DB la podum.)
//
//  PRODUCTS array same object ah in-place update pannrom, so ProductList, CartDrawer,
//  CheckoutPage, recommend.js ellam pazhaya maadhiriye `PRODUCTS` / `getProduct` use pannalam.
// ─────────────────────────────────────────────────────────────
import { api } from '../../shared/api/client.js'
import { resolveImage } from '../../shared/utils/images.js'

export const PRODUCTS = []

export const getProduct = (id) => PRODUCTS.find(p => p.id === Number(id))

export const DELIVERY = 5.00

// Backend product -> the shape the UI components already use
export function toUiProduct(p) {
  return {
    id:        p.pid,
    _id:       p.id,
    name:      p.name,
    unit:      p.unit,
    price:     p.price,
    oldPrice:  p.mrp && p.mrp > p.price ? p.mrp : null,
    discount:  p.discount || null,
    cat:       p.category,
    tag:       p.tag,
    img:       resolveImage(p.image_url),
    stock:     p.stock,
    storeId:   p.store_id,
    storeName: p.store_name,
    expiry:    p.expiry_date || null,
  }
}

export async function loadCatalog() {
  const list = await api.get('/api/products')
  PRODUCTS.splice(0, PRODUCTS.length, ...list.map(toUiProduct))
  return PRODUCTS
}
