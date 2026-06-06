import { PRODUCTS } from '../../lib/products'
import ShopGrid from './ShopGrid'
import Link from 'next/link'
import { getSaleActive } from '../../lib/siteConfig'

export const metadata = {
  title: 'Shop Research Peptides',
  description: 'Browse our full catalog of research peptides  BPC-157, TB-500, Semaglutide, CJC-1295, Ipamorelin, GHK-Cu, and more. All independently third-party lab tested with 99%+ purity.',
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
        <div style={{ background: '#FF1F6E' }} className="w-full rounded-xl p-4 mb-8 text-center">
          <p className="text-white font-bold tracking-wide text-sm sm:text-base">
            🔥 Start of Summer Sale — 15% off everything with code{' '}
            <span style={{ background: '#AAFF00', color: '#1a3300' }}
              className="inline-block font-black px-3 py-1 rounded-full text-sm tracking-widest mx-1">
              SUMMER15
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
