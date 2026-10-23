// Category strip (navbar) la irukkura categories.
// title -> Home page tile/row heading (Zepto style). label -> navbar strip.
// id -> products.js la irukkura `cat` value. label/icon maathalam. icon -> Lucide icon name (components/Icon.jsx la irukku).
// badge (optional) -> chinna offer tag navbar category mela kaattum. Venaam na andha line la `badge` remove pannunga.
// Ippo categories backend la irundhu varum (admin -> Add product -> Manage la add/delete pannalam).
// Keela irukkura list backend reach aagalana fallback mattum.
const ALL = { id: 'all', label: 'All', icon: 'shopping-cart' }

export const CATEGORIES = [
  { id: 'all',       label: 'All',            icon: 'shopping-cart' },
  { id: 'dairy',     label: 'Dairy',          icon: 'milk', title: 'Dairy & Eggs' },
  { id: 'fruits',    label: 'Fruits & Veg',   icon: 'apple', badge: '30% OFF', title: 'Fruits & Vegetables' },
  { id: 'meat',      label: 'Meat & Fish',    icon: 'fish', title: 'Meat & Fish' },
  { id: 'snacks',    label: 'Snacks',         icon: 'popcorn', badge: 'NEW', title: 'Snacks & Munchies' },
  { id: 'beverage',  label: 'Beverage',       icon: 'cup-soda', title: 'Cold Drinks & Tea' },
  { id: 'breakfast', label: 'Breakfast',      icon: 'egg-fried', title: 'Breakfast & Bakery' },
  { id: 'cooking',   label: 'Cooking',        icon: 'cooking-pot', title: 'Atta, Oil & Cooking' },
  { id: 'home',      label: 'Home & Cleaning', icon: 'spray-can', title: 'Home & Cleaning' },
  { id: 'petcare',   label: 'Pet Care',       icon: 'paw-print', title: 'Pet Care' },
]

// Backend list ah same array la in-place podrom (Navbar, CategoryGrid, CategorySection ellam idha use pannum).
// `usedIds` kudutha, products illatha categories customer ku kaattathu.
export function setCategories(list, usedIds) {
  const shown = usedIds ? list.filter(c => usedIds.has(c.id)) : list
  CATEGORIES.splice(0, CATEGORIES.length, ALL, ...shown)
}
