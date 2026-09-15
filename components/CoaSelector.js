'use client'

// Batch-picker dropdown for a product's Certificates of Analysis. Replaces a
// flat, ever-growing list of COA links with a single control -- picking a
// batch opens that COA PDF in a new tab. Shared by the standard shop product
// page and the Lab-restricted product card.
export default function CoaSelector({ coas, size = 'md' }) {
  if (!coas || coas.length === 0) return null

  function handleChange(e) {
    const href = e.target.value
    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer')
    }
    e.target.value = ''
  }

  const sizeClasses = size === 'sm'
    ? 'text-[11px] py-2 pl-3 pr-8'
    : 'text-sm py-2.5 pl-4 pr-10'
  const iconRight = size === 'sm' ? 'right-2.5' : 'right-3'
  const iconSize = size === 'sm' ? 10 : 12

  return (
    <div className="relative inline-block w-full sm:w-auto">
      <select
        defaultValue=""
        onChange={handleChange}
        aria-label="Select Batch to View Certificate of Analysis"
        className={`w-full appearance-none bg-white border border-gray-300 rounded-lg font-medium text-[#0d1b2a] cursor-pointer hover:border-[#2196f3] focus:outline-none focus:ring-2 focus:ring-[#2196f3]/30 transition-colors ${sizeClasses}`}
      >
        <option value="" disabled>Select Batch to View COA</option>
        {coas.map((coa, i) => (
          <option key={i} value={coa.href}>
            {coa.text.replace(/^View Certificate of Analysis\s*[–-]\s*/, '')}
          </option>
        ))}
      </select>
      <svg
        className={`pointer-events-none absolute ${iconRight} top-1/2 -translate-y-1/2`}
        width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
  )
}
