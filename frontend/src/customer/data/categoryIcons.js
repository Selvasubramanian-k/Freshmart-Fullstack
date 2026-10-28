// Category icon: peyar vachu thaane select aagum (admin venumna maathalam).
// Same rules backend la irukku (backend/app/controllers/category_controller.py ICON_RULES).
// key -> components/Icon.jsx la irukkura icon name.
export const ICON_CHOICES = [
  ['diya', 'Diya'], ['sparkles', 'Festive'], ['flower', 'Flowers'], ['gift', 'Gift'],
  ['baby', 'Baby'], ['droplet', 'Care'], ['spray-can', 'Cleaning'], ['paw-print', 'Pets'],
  ['milk', 'Milk'], ['apple', 'Fruits'], ['carrot', 'Veggies'], ['fish', 'Fish'],
  ['wheat', 'Grains'], ['flame', 'Masala'], ['jar', 'Pickle'], ['cooking-pot', 'Cooking'],
  ['snowflake', 'Frozen'], ['ice-cream', 'Ice cream'], ['egg-fried', 'Breakfast'], ['soup', 'Instant'],
  ['popcorn', 'Snacks'], ['cookie', 'Biscuits'], ['candy', 'Sweets'], ['cake', 'Bakery'],
  ['cup-soda', 'Drinks'], ['coffee', 'Tea/Coffee'], ['leaf', 'Health'], ['pill', 'Medicine'],
  ['pencil', 'School'], ['utensils', 'Kitchen'], ['shopping-bag', 'General'],
].map(([key, label]) => ({ key, label }))

const RULES = [
  [/pooja|puja|poojai|diya|vilakku|deepam/, 'diya'],
  [/festive|festival|diwali|deepavali|pongal|party/, 'sparkles'],
  [/baby|kids|infant/, 'baby'],
  [/ice ?cream/, 'ice-cream'],
  [/frozen|ready to cook/, 'snowflake'],
  [/rice|dal|atta|grain|flour|millet|arisi/, 'wheat'],
  [/pickle|oorugai|jam|sauce/, 'jar'],
  [/masala|spice|podi|chilli/, 'flame'],
  [/cake|bakery/, 'cake'],
  [/biscuit|cookie/, 'cookie'],
  [/sweet|chocolate|candy|mithai/, 'candy'],
  [/medicine|pharma|medical|tablet/, 'pill'],
  [/health|organic|wellness|nuts|dry fruit|herbal/, 'leaf'],
  [/flower|poo\b|garland/, 'flower'],
  [/stationery|school|office|book/, 'pencil'],
  [/gift/, 'gift'],
  [/kitchen|utensil|disposable/, 'utensils'],
  [/coffee|tea/, 'coffee'],
  [/soup|noodle|instant/, 'soup'],
  [/vegetable|veggies/, 'carrot'],
  [/personal|beauty|soap|bath|skin|hair/, 'droplet'],
]

export function autoIcon(name) {
  const n = (name || '').toLowerCase()
  const hit = RULES.find(([re]) => re.test(n))
  return hit ? hit[1] : 'shopping-bag'
}
