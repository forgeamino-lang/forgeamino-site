'use client'

import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'

export const MAX_QTY = 99

// − [ n ] + quantity control. Clamps to 1–99 (same bounds as the orders API).
// The box keeps a draft while typing, so clearing it to type "7" doesn't
// snap back to 1 first; the value is committed as soon as it's a valid number.
export default function QuantityStepper({ value, onChange, size = 'md' }) {
  const clamp = n => Math.max(1, Math.min(MAX_QTY, parseInt(n, 10) || 1))
  // While the box has focus it shows what the customer is typing; otherwise
  // it always shows the real quantity (so +/− and bracket clicks never lag).
  const [draft, setDraft] = useState(null)

  const btn = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'
  const box = size === 'sm' ? 'w-10 h-7 text-xs' : 'w-14 h-9 text-sm'
  const icon = size === 'sm' ? 12 : 14
  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= 1}
        className={`${btn} rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
      >
        <Minus size={icon} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label="Quantity"
        value={draft ?? String(value)}
        onChange={e => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 2)
          setDraft(digits)
          if (digits !== '' && parseInt(digits, 10) > 0) onChange(clamp(digits))
        }}
        onBlur={() => setDraft(null)}
        onFocus={e => { setDraft(String(value)); e.target.select() }}
        className={`${box} text-center font-bold text-[#0d1b2a] rounded-lg border-2 border-gray-200 focus:border-[#2196f3] focus:outline-none`}
      />
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= MAX_QTY}
        className={`${btn} rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
      >
        <Plus size={icon} />
      </button>
    </div>
  )
}
