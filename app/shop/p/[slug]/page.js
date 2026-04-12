import { notFound } from 'next/navigation'
import Image from 'next/image'
import { PRODUCTS, getProductBySlug, formatPrice } from '../../../../lib/products'
import AddToCartButton from './AddToCartButton'

export async function generateStaticParams() {
  return PRODUCTS.map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }) {
  const product = getProductBySlug(params.slug)
  if (!product) return { title: 'Product Not Found' }
  return {
    title: `${product.name} | Forge Amino`,
    description: product.description,
  }
}

export default function ProductPage({ params }) {
  const product = getProductBySlug(params.slug)
  if (!product) notFound()

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
        {/* Product image */}
        <div className="bg-white rounded-lg p-8" style={{ height: '420px', position: 'relative' }}>
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain p-8"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        </div>

        {/* Product details */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">{product.category}</p>
          <h1 className="text-3xl font-bold text-[#0d1b2a] tracking-wide mb-4 uppercase">
            {product.name}
          </h1>
          <p className="text-2xl font-bold text-[#0d1b2a] mb-6">
            {formatPrice(product.price)}
          </p>

          <p className="text-gray-600 leading-relaxed mb-8">
            {product.description}
          </p>

          <AddToCartButton product={product} />

          {/* Research disclaimer */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong>For Research Purposes Only.</strong> This product is not intended for human consumption.
              By purchasing, you confirm that you are a qualified researcher and will use this product
              in compliance with all applicable laws and regulations.
            </p>
          </div>

          {/* Payment info */}
          <div className="mt-4 p-4 bg-[#f0f7ff] rounded-lg border border-[#2196f3]/20">
            <p className="text-xs text-[#0d1b2a] font-semibold mb-1">💳 How Payment Works</p>
            <p className="text-xs text-gray-600 leading-relaxed">
              Place your order, then send payment via Venmo to <strong>@ForgeA</strong>.
              Full instructions will be emailed to you immediately after checkout.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
