'use client'

import { useEffect, useRef, useState } from 'react'

// Batch-picker dropdown for a product's Certificates of Analysis. Replaces a
// flat, ever-growing list of COA links with a single collapsed control.
//
// IMPORTANT: this renders a toggle button + a list of real <a target="_blank">
// links, NOT a native <select> with a JS-triggered window.open(). Safari
// (macOS and iOS) does not treat a <select> "change" event as a direct user
// gesture -- the native picker UI mediates it -- so window.open() called from
// onChange gets silently popup-blocked there. A genuine anchor-tag click is
// always a trusted gesture in every browser, so it can never be blocked.
export default function CoaSelector({ coas, size = 'md' }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  if (!coas || coas.length === 0) return null

  const sizeClasses = size === 'sm'
    ? 'text-[11px] py-2 pl-3 pr-8'
    : 'text-sm py-2.5 pl-4 pr-10'
  const iconRight = size === 'sm' ? 'right-2.5' : 'right-3'
  const iconSize = size === 'sm' ? 10 : 12
  const itemTextSize = size === 'sm' ? 'text-[11px]' : 'text-sm'

  return (
    <div className="relative inline-block w-full sm:w-auto" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`relative w-full text-left bg-white border border-gray-300 rounded-lg font-medium text-[#0d1b2a] cursor-pointer hover:border-[#2196f3] focus:outline-none focus:ring-2 focus:ring-[#2196f3]/30 transition-colors ${sizeClasses}`}
      >
        Select Batch to View COA
        <svg
          className={`pointer-events-none absolute ${iconRight} top-1/2 -translate-y-1/2 transition-transform ${open ? 'rotate-180' : ''}`}
          width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full sm:min-w-[240px] bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto"
        >
          {coas.map((coa, i) => (
            <li key={i} role="presentation">
              <a
                href={coa.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className={`block px-4 py-2 ${itemTextSize} text-[#0d1b2a] hover:bg-gray-50 hover:text-[#2196f3] transition-colors`}
              >
                {coa.text.replace(/^View Certificate of Analysis\s*[–-]\s*/, '')}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
