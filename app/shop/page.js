import { PRODUCTS } from '../../lib/products'
import ShopGrid from './ShopGrid'
import Link from 'next/link'
import { getSaleActive } from '../../lib/siteConfig'

export const metadata = {
  title: 'Shop Research Peptides',
  description: 'Browse our full catalog of research peptides  BPC-157, TB-500, CJC-1295, Ipamorelin, GHK-Cu, and more. All independently third-party lab tested with 99%+ purity.',
  alternates: {
    canonical: 'https://www.forgeamino.com/shop',
  },
  openGraph: {
    title: 'Shop Research Peptides | Forge Amino',
    description: 'Browse our full catalog of research peptides. All independently third-party lab tested with 99%+ purity.',
    url: 'https://www.forgeamino.com/shop',
  },
}

export default async function ShopPage() {
  const activeProducts = PRODUCTS.filter(p => (p.inStock || p.price === 0) && !p.hidden)
  const saleActive = await getSaleActive()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

      {saleActive && (
        <div
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.35) 1px, transparent 1.5px), linear-gradient(90deg, #B22234 0%, #0A1F44 50%, #B22234 100%)',
            backgroundSize: '18px 18px, 100% 100%',
          }}
          className="w-full rounded-xl p-4 mb-8 text-center border-2 border-white/40"
        >
          <p className="text-white font-bold tracking-wide text-sm sm:text-base">
            🇺🇸 Labor Day Sale — 30% off everything with code{' '}
            <span style={{ background: '#ffffff', color: '#B22234' }}
              className="inline-block font-black px-3 py-1 rounded-full text-sm tracking-widest mx-1 border border-[#0A1F44]">
              LABORDAY30
            </span>
          </p>
        </div>
      )}

      <ShopGrid products={activeProducts} />

      {/* Research disclaimer */}
      <p className="text-center text-xs text-gray-400 mt-16 max-w-xl mx-auto">
        All products are for research purposes only and are not intended for human consumption.
        By purchasing you confirm you are a qualified researcher.
      </p>
    </div>
  )
}
