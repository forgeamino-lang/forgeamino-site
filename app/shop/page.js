import { PRODUCTS } from '../../lib/products'
import ProductCard from '../../components/ProductCard'
import Link from 'next/link'

export const metadata = {
  title: 'Shop Research Peptides | Forge Amino',
  description: 'Browse our full catalog of research peptides — BPC-157, TB-500, Semaglutide, CJC-1295, Ipamorelin, GHK-Cu, and more. All independently third-party lab tested with 99%+ purity.',
  alternates: {
    canonical: 'https://www.forgeamino.us/shop',
  },
  openGraph: {
    title: 'Shop Research Peptides | Forge Amino',
    description: 'Browse our full catalog of research peptides. All independently third-party lab tested with 99%+ purity.',
    url: 'https://www.forgeamino.us/shop',
  },
}

export default function ShopPage() {
  const activeProducts = PRODUCTS.filter(p => p.inStock || p.price === 0)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* ── CUSTOM REQUEST BANNER ── */}
      <div className="bg-[#f0f7ff] border-y border-[#2196f3]/20 py-4 mb-6">
        <div className="flex items-center justify-center gap-3 text-center flex-wrap">
          <span className="text-lg">💬</span>
          <p className="text-sm text-[#0d1b2a]">
            <span className="font-bold">Don&apos;t see a product you&apos;re interested in?</span>{' '}
            We&apos;re happy to help source it —{' '}
            <Link href="/contact" className="text-[#2196f3] font-bold hover:underline">contact us →</Link>
          </p>
        </div>
      </div>
      {/* Sort/filter bar */}
      <div className="flex items-center justify-end mb-8 pb-4 border-b border-gray-200">
        <span className="text-xs text-gray-400 uppercase tracking-widest">
          {activeProducts.length} Products
        </span>
      </div>

      {/* Product grid */}
      <div className="product-grid">
        {activeProducts.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Research disclaimer */}
      <p className="text-center text-xs text-gray-400 mt-16 max-w-xl mx-auto">
        All products are for research purposes only and are not intended for human consumption.
        By purchasing you confirm you are a qualified researcher.
      </p>
    </div>
  )
}
