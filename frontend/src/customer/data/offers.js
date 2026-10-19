// ─────────────────────────────────────────────────────────────
//  OFFERS  (Offers page-la 4 cards)
//  productIds -> src/data/products.js la irukkura ids.
//  Offer-ku products maathanum na inga ids mathunga.
//  cat -> "See all" button click panna Home page-la entha category open aagum
// ─────────────────────────────────────────────────────────────
export const OFFERS = [
  {
    id: 'fruits',
    title: 'Fresh Fruits',
    sub: 'Up to 30% off',
    headline: 'Up to 30% off on fresh fruits and vegetables',
    color: '#00a870',
    icon: 'apple',
    cat: 'fruits',
    browseLabel: 'Fruits & Vegetables',
    // Apple, Banana, Orange, Pineapple, Carrot, Tomato, Onion
    productIds: [1, 2, 3, 4, 5, 8, 47],
  },
  {
    id: 'dairy',
    title: 'Dairy & Eggs',
    sub: 'Free delivery ₹299+',
    headline: 'Free delivery on dairy and egg orders above ₹299',
    color: '#f5a623',
    icon: 'milk',
    cat: 'dairy',
    browseLabel: 'Dairy',
    // Milk, Butter, Ghee, Curd, Eggs, Paneer, Buttermilk
    productIds: [22, 23, 24, 25, 26, 46, 32],
  },
  {
    id: 'meat',
    title: 'Meat & Fish',
    sub: '15% off today',
    headline: '15% off on meat and fish today',
    color: '#3b82f6',
    icon: 'fish',
    cat: 'meat',
    browseLabel: 'Meat & Fish',
    // Fish, Chicken, Chicken Liver, Mutton
    productIds: [10, 11, 12, 13],
  },
  {
    id: 'snacks',
    title: 'Snacks',
    sub: 'Buy 2 Get 1 Free',
    headline: 'Buy 2 Get 1 Free on snacks',
    color: '#ec4899',
    icon: 'popcorn',
    cat: 'snacks',
    browseLabel: 'Snacks',
    // Lays, Bingo, Soft Drinks, Cookies, Ice Cream, Mixture, Marie
    productIds: [14, 15, 16, 17, 50, 51, 38],
  },
]
