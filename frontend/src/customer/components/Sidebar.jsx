import React from 'react'
import Icon from './Icon.jsx'

const CATEGORIES = [
  { id: 'all',       label: 'All Products',       icon: 'shopping-cart' },
   { id: 'dairy',     label: 'Dairy',               icon: 'milk' },
  { id: 'fruits',    label: 'Fruits & Vegetables', icon: 'apple' },
  { id: 'meat',      label: 'Meat & Fish',         icon: 'fish' },
  { id: 'snacks',    label: 'Snacks',              icon: 'popcorn' },
  { id: 'beverage',  label: 'Beverage',            icon: 'cup-soda' },
  { id: 'breakfast', label: 'Breakfast',           icon: 'egg-fried' },
  { id: 'cooking',   label: 'Cooking',             icon: 'cooking-pot' },
  { id: 'home',      label: 'Home & Cleaning',     icon: 'spray-can' },
  { id: 'petcare',   label: 'Pet Care',            icon: 'paw-print' },
]

function Sidebar({ activeCat, onSelect, isOpen, onClose }) {
  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
          <div className="right-drawer-header">
              <span>Categories</span>
              <button  className="sidebar-close-btn"  onClick={onClose}><Icon name="x" /></button>
          </div>
        {CATEGORIES.map((cat) => (  
          <button
            key={cat.id}
            className={`sidebar-item ${activeCat === cat.id ? 'active' : ''}`}
            onClick={() => onSelect(cat.id)}
          >
            <span className="sidebar-item-left">
              <span className="sidebar-icon"><Icon name={cat.icon} /></span>
              <span>{cat.label}</span>
            </span>
            <span className="sidebar-chevron"><Icon name="chevron-right" /></span>
          </button>
        ))}
      </aside>
    </>
  )
}

export default Sidebar