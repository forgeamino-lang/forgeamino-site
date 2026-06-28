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
  const [sortOrder, setSortOrder] = useState('default')

  const filtered = activeTag === '' ? products : products.filter(p => p.tags && p.tags.includes(activeTag))
  const displayed = sortOrder === 'az'
    ? [...filtered].sort((a, b) => a.name.localeCompare(b.name))
    : filtered

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
        <span className="text-xs text-gray-400 uppercase tracking-widest">
          {displayed.length} Product{displayed.length !== 1 ? 's' : ''}
        </span>

        {/* Sort toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: '4px' }}>Sort</span>
          {[{ key: 'default', label: 'Default' }, { key: 'az', label: 'A-Z' }].map(opt => {
            const isActive = sortOrder === opt.key
            return (
              <button
                key={opt.key}
                onClick={() => setSortOrder(opt.key)}
                style={{
                  backgroundColor: isActive ? '#2196f3' : 'transparent',
                  color: isActive ? '#ffffff' : '#6b7280',
                  border: isActive ? '1px solid #2196f3' : '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: isActive ? '600' : '400',
                  cursor: 'pointer',
                  letterSpacing: '0.03em',
                  transition: 'all 0.15s ease',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map(cat => {
          const count = cat.key === '' ? products.length : products.filter(p => p.tags && p.tags.includes(cat.key)).length
          if (count === 0 && cat.key !== '') return null
          const isActive = activeTag === cat.key
          return (
            <button key={cat.key} onClick={() => setActiveTag(cat.key)}
              style={{
                backgroundColor: isActive ? '#2196f3' : '#e3f2fd',
                color: isActive ? '#ffffff' : '#1565c0',
                border: isActive ? '1px solid #2196f3' : '1px solid #90caf9',
                borderRadius: '9999px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: isActive ? '600' : '500',
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
        {displayed.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}
