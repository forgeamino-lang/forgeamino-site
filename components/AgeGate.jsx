'use client'

import { useState, useEffect } from 'react'

export default function AgeGate() {
  const [verified, setVerified] = useState(true)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const ageVerified = localStorage.getItem('fa-age-verified')
    if (!ageVerified) {
      setVerified(false)
    }
  }, [])

  const handleEnter = () => {
    if (checked) {
      localStorage.setItem('fa-age-verified', 'true')
      setVerified(true)
    }
  }

  if (verified) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: '#0d1b2a' }}>
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, #0d2a3a 0%, #0d1b2a 70%)' }} />

      <div className="relative z-10 w-full max-w-sm mx-6 text-center">

        {/* Logo mark */}
        <div className="mb-2">
          <img src="/logo.png" alt="Forge Amino" className="h-16 w-auto mx-auto" onError={(e) => { e.target.style.display = 'none' }} />
        </div>

        {/* Brand name */}
        <p className="font-bold tracking-widest text-white text-2xl mb-1">FORGE AMINO</p>
        <p className="tracking-widest text-xs mb-8" style={{ color: '#4fc3f7' }}>RESEARCH PEPTIDES</p>

        {/* Divider */}
        <div className="mx-auto mb-8" style={{ width: '48px', height: '1px', background: '#4fc3f7' }} />

        {/* Heading */}
        <h2 className="text-white text-lg font-semibold mb-3">Age Verification Required</h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: '#9ca3af' }}>
          This website contains information about research compounds intended for adults only.
          You must be 21 years of age or older to enter.
        </p>

        {/* Checkbox */}
        <label className="flex items-start gap-3 text-left mb-8 cursor-pointer p-4 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded"
            style={{ accentColor: '#4fc3f7' }}
          />
          <span className="text-sm leading-relaxed" style={{ color: '#d1d5db' }}>
            Yes &mdash; I validate that I am 21 years of age or older
          </span>
        </label>

        {/* Enter button */}
        <button
          onClick={handleEnter}
          disabled={!checked}
          className="w-full py-3 px-6 rounded font-semibold tracking-widest text-sm transition-all"
          style={checked
            ? { background: '#4fc3f7', color: '#0d1b2a', cursor: 'pointer' }
            : { background: '#1f2937', color: '#4b5563', cursor: 'not-allowed' }
          }
        >
          ENTER SITE
        </button>

        {/* Legal note */}
        <p className="text-xs mt-6 leading-relaxed" style={{ color: '#4b5563' }}>
          All products are for research and development purposes only.<br />Not for human consumption.
        </p>
      </div>
    </div>
  )
}
