import { PRODUCTS } from '../../lib/products'
import ShopGrid from './ShopGrid'
import Link from 'next/link'

export const metadata = {
  title: 'Shop Research Peptides',
  description: 'Browse our full catalog of research peptides  BPC-157, TB-500, Semaglutide, CJC-1295, Ipamorelin, GHK-Cu, and more. All independently third-party lab tested with 99%+ purity.',
  alternates: {
    canonical: 'https://www.forgeamino.com/shop',
  },
  openGraph: {
    title: 'Shop Research Peptides | Forge Amino',
    description: 'Browse our full catalog of research peptides. All independently third-party lab tested with 99%+ purity.',
    url: 'https://www.forgeamino.com/shop',
  },
}

export default function ShopPage() {
  const activeProducts = PRODUCTS.filter(p => (p.inStock || p.price === 0) && !p.hidden && !p.comingSoon)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

      <ShopGrid products={activeProducts} />

      {/* Research disclaimer */}
      <p className="text-center text-xs text-gray-400 mt-16 max-w-xl mx-auto">
        All products are for research purposes only and are not intended for human consumption.
        By purchasing you confirm you are a qualified researcher.
      </p>
    </div>
  )
}
