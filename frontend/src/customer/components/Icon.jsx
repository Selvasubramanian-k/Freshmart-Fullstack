// Thin wrapper over lucide-react (npm install lucide-react).
// Use: <Icon name="zap" />  or  <Icon id="dairy" />  (id = category id from data/categories.js)
// Size follows the parent font-size (1em) and colour follows the parent text colour.
// Data files (categories, offers, recommend) store icon NAMES as strings, this file turns them into icons.
import {
  ShoppingCart, ShoppingBag, Milk, Apple, Fish, Popcorn, CupSoda, EggFried, CookingPot, SprayCan, PawPrint, Pill,
  Zap, Search, User, Store, Gift, Phone, LogOut, X, Trash2, Sparkles, Flame, Tag, Package, Truck, Smartphone,
  ClipboardList, Receipt, CreditCard, Landmark, Banknote, Lock, Building2, House, MapPin, Check, Undo2, Wallet,
  ChevronRight, Mail, Clock, Star, Sunrise, Sun, Sunset, Moon, ThermometerSun, CloudRain, Snowflake, CloudSun,
  EllipsisVertical, Headphones,
} from 'lucide-react'

const BY_NAME = {
  'shopping-cart': ShoppingCart, 'shopping-bag': ShoppingBag,
  milk: Milk, apple: Apple, fish: Fish, popcorn: Popcorn, 'cup-soda': CupSoda, 'egg-fried': EggFried,
  'cooking-pot': CookingPot, 'spray-can': SprayCan, 'paw-print': PawPrint, pill: Pill,
  zap: Zap, search: Search, user: User, store: Store, gift: Gift, phone: Phone, 'log-out': LogOut,
  x: X, trash: Trash2, sparkles: Sparkles, flame: Flame, tag: Tag, package: Package, truck: Truck,
  smartphone: Smartphone, 'clipboard-list': ClipboardList, receipt: Receipt, 'credit-card': CreditCard,
  landmark: Landmark, banknote: Banknote, lock: Lock, building: Building2, house: House, 'map-pin': MapPin,
  check: Check, undo: Undo2, wallet: Wallet, 'chevron-right': ChevronRight, mail: Mail, clock: Clock, star: Star,
  sunrise: Sunrise, sun: Sun, sunset: Sunset, moon: Moon, 'thermometer-sun': ThermometerSun,
  'cloud-rain': CloudRain, snowflake: Snowflake, 'cloud-sun': CloudSun, 'ellipsis-vertical': EllipsisVertical,
  headphones: Headphones,
}

const CATEGORY_ICON = {
  all: 'shopping-cart', dairy: 'milk', fruits: 'apple', meat: 'fish', snacks: 'popcorn',
  beverage: 'cup-soda', breakfast: 'egg-fried', cooking: 'cooking-pot', home: 'spray-can', petcare: 'paw-print',
  health: 'pill',
}

export default function Icon({ name, id, strokeWidth = 1.9 }) {
  const Cmp = BY_NAME[name || CATEGORY_ICON[id]] || ShoppingCart
  return <Cmp size="1em" strokeWidth={strokeWidth} aria-hidden="true" focusable="false" />
}
