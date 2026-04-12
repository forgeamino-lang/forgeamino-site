'use client'

import { createContext, useContext, useReducer, useEffect } from 'react'

const CartContext = createContext(null)

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.find(i => i.slug === action.item.slug)
      if (existing) {
        return state.map(i =>
          i.slug === action.item.slug
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }
      return [...state, { ...action.item, quantity: 1 }]
    }
    case 'REMOVE_ITEM':
      return state.filter(i => i.slug !== action.slug)
    case 'UPDATE_QUANTITY':
      if (action.quantity <= 0) return state.filter(i => i.slug !== action.slug)
      return state.map(i =>
        i.slug === action.slug ? { ...i, quantity: action.quantity } : i
      )
    case 'CLEAR_CART':
      return []
    case 'HYDRATE':
      return action.items
    default:
      return state
  }
}

export function CartProvider({ children }) {
  const [cart, dispatch] = useReducer(cartReducer, [])

  // Load cart from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('forge-cart')
    if (saved) {
      try {
        dispatch({ type: 'HYDRATE', items: JSON.parse(saved) })
      } catch {}
    }
  }, [])

  // Save cart to sessionStorage on every change
  useEffect(() => {
    sessionStorage.setItem('forge-cart', JSON.stringify(cart))
  }, [cart])

  const addItem = (product) => dispatch({ type: 'ADD_ITEM', item: product })
  const removeItem = (slug) => dispatch({ type: 'REMOVE_ITEM', slug })
  const updateQuantity = (slug, quantity) => dispatch({ type: 'UPDATE_QUANTITY', slug, quantity })
  const clearCart = () => dispatch({ type: 'CLEAR_CART' })

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)
  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <CartContext.Provider value={{ cart, addItem, removeItem, updateQuantity, clearCart, cartCount, cartTotal }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
