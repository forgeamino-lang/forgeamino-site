import { PRODUCTS } from '../../lib/products'
import { verifyLabCookie } from '../../lib/labAuth'
import LabUnlockForm from '../../components/LabUnlockForm'
import LabControls from '../../components/LabControls'
import ProductCard from '../../components/ProductCard'
import LabProductCard from '../../components/LabProductCard'

// Must be dynamic — cookie-gated content.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Lab',
  description: 'Restricted-access catalog for qualified researchers.',
  robots: { index: false, follow: false },
}

export default function LabPage() {
  const unlocked = verifyLabCookie()

  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 sm:py-24">
        <div className="bg-[#0d1b2a] text-white rounded-2xl p-8 shadow-xl border border-[#c9a227]/30">
          <div className="flex items-center gap-3 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/>
              <line x1="8.5" y1="2" x2="15.5" y2="2"/>
              <line x1="7" y1="16" x2="17" y2="16"/>
            </svg>
            <h1 className="text-xl font-bold uppercase tracking-widest">Lab Access</h1>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed mb-6">
            Restricted-access research materials. Enter your access code to unlock this session.
          </p>
          <LabUnlockForm />
          <p className="text-[10px] text-gray-500 mt-6 leading-relaxed uppercase tracking-widest">
            Session-only — unlock expires when you close the browser.
          </p>
        </div>
      </div>
    )
  }

  // Unlocked: regular (non-hidden) + hidden products.
  const regular = PRODUCTS.filter(p => (p.inStock || p.price === 0) && !p.hidden)
  const hidden  = PRODUCTS.filter(p => (p.inStock || p.price === 0) && p.hidden)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 bg-[#c9a227] text-[#0d1b2a] text-xs font-black px-2.5 py-1 rounded uppercase tracking-widest">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/>
              <line x1="8.5" y1="2" x2="15.5" y2="2"/>
            </svg>
            LAB
          </span>
          <span className="text-xs text-gray-400 uppercase tracking-widest">
            Unlocked — {hidden.length} restricted + {regular.length} standard
          </span>
        </div>
        <LabControls />
      </div>

      {/* Hidden products first */}
      {hidden.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#c9a227] mb-4">Restricted Access</h2>
          <div className="product-grid">
            {hidden.map(p => <LabProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}

      {hidden.length === 0 && (
        <div className="mb-10 p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <p className="text-sm text-gray-500">No restricted-access products available right now.</p>
        </div>
      )}

      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Standard Catalog</h2>
        <div className="product-grid">
          {regular.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 mt-16 max-w-xl mx-auto">
        All products are for research purposes only and are not intended for human consumption.
        By purchasing you confirm you are a qualified researcher.
      </p>
    </div>
  )
}
