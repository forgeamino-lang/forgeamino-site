import { PRODUCTS } from '../../lib/products'
import ProductCard from '../../components/ProductCard'

export const metadata = {
  title: 'Shop | Forge Amino',
  description: 'Browse research peptides from Forge Amino.',
}

export default function ShopPage() {
  const activeProducts = PRODUCTS.filter(p => p.inStock || p.price === 0)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
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
