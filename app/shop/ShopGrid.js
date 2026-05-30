'use client'

import { useState } from 'react'
import ProductCard from '../../components/ProductCard'

const CATEGORIES = [
  { key: '', label: 'All' },
  { key: 'anti-inflammatory', label: 'Anti-Inflammatory Research' },
  { key: 'anti-aging', label: 'Anti-Aging Research' },
  { key: 'mitochondrial', label: 'Mitochondrial & Metabolic Research' },
  { key: 'growth-hormone', label: 'Growth Hormone Research' },
  { key: 'cognitive', label: 'Cognitive Research' },
  { key: 'immune', label: 'Immune Research' },
]

export default function ShopGrid({ products }) {
  const [activeTag, setActiveTag] = useState('')

  const filtered = activeTag === ''
    ? products
    : products.filter(p => p.tags && p.tags.includes(activeTag))

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center justify-end mb-8 pb-4 border-b border-gray-200">
        <span className="text-xs text-gray-400 uppercase tracking-widest">
          {filtered.length} Product{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map(cat => {
          const count = cat.key === ''
            ? products.length
            : products.filter(p => p.tags && p.tags.includes(cat.key)).length
          if (count === 0 && cat.key !== '') return null
          const isActive = activeTag === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => setActiveTag(cat.key)}
              style={{
                backgroundColor: isActive ? '#2196f3' : 'transparent',
                color: isActive ? '#ffffff' : '#6b7280',
                border: isActive ? '1px solid #2196f3' : '1px solid #d1d5db',
                borderRadius: '9999px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: isActive ? '600' : '400',
                cursor: 'pointer',
                letterSpacing: '0.03em',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {cat.label}{cat.key !== '' ? ` (${count})` : ''}
            </button>
          )
        })}
      </div>

      {/* Product grid */}
      <div className="product-grid">
        {filtered.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}
