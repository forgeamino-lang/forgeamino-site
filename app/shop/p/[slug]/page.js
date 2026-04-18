import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { PRODUCTS, getProductBySlug, formatPrice } from '../../../../lib/products'
import AddToCartButton from './AddToCartButton'

export const dynamicParams = false

export async function generateStaticParams() {
  return PRODUCTS.filter(p => !p.hidden).map(p => ({ slug: p.slug }))
}

const BASE_URL = 'https://www.forgeamino.com'

export async function generateMetadata({ params }) {
  const product = getProductBySlug(params.slug)
  if (!product || product.hidden) return { title: 'Product Not Found' }
  const description = (product.tagline || product.description || '').slice(0, 155)
  const productUrl = `${BASE_URL}/shop/p/${product.slug}`
  const imageUrl = `${BASE_URL}${product.image}`
  return {
    title: product.name,
    description,
    alternates: { canonical: productUrl },
    openGraph: {
      title: `${product.name} | Forge Amino`,
      description,
      url: productUrl,
      type: 'website',
      images: [{ url: imageUrl, width: 800, height: 800, alt: product.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} | Forge Amino`,
      description,
      images: [imageUrl],
    },
  }
}

export default function ProductPage({ params }) {
  const product = getProductBySlug(params.slug)
  if (!product || product.hidden) notFound()

  const mechanismsLabel = product.mechanismsLabel || 'Mechanisms of Action'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.tagline || product.description || '',
    image: `${BASE_URL}${product.image}`,
    url: `${BASE_URL}/shop/p/${product.slug}`,
    brand: {
      '@type': 'Brand',
      name: 'Forge Amino',
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: product.price.toFixed(2),
      availability: product.inStock && product.price > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/PreOrder',
      url: `${BASE_URL}/shop/p/${product.slug}`,
      seller: {
        '@type': 'Organization',
        name: 'Forge Amino',
      },
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 mb-6 sm:mb-8 flex items-center gap-1">
        <Link href="/shop" className="hover:text-[#2196f3] transition-colors">Shop</Link>
        <span>›</span>
        <span className="text-[#0d1b2a]">{product.name}</span>
      </nav>

      {/* Top section: image + right-side details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start mb-10 md:mb-12">
        {/* Product image */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm relative h-[280px] sm:h-[360px] md:h-[420px]">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain p-8"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
          {(!product.inStock || product.price === 0) && (
            <div className="absolute inset-0 bg-black/30 rounded-xl flex items-center justify-center">
              <span className="bg-white text-[#0d1b2a] text-xs font-bold px-4 py-2 rounded uppercase tracking-wider">
                Coming Soon
              </span>
            </div>
          )}
        </div>

        {/* Right column: name, price, tagline, add to cart */}
        <div>
          <h1 className="text-2xl font-bold text-[#0d1b2a] tracking-wider uppercase leading-tight mb-3">
            {product.name}
          </h1>
          <p className="text-2xl font-bold text-[#0d1b2a] mb-5">
            {formatPrice(product.price)}
          </p>

          {/* Tagline */}
          {product.tagline && (
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              {product.tagline}
            </p>
          )}

          <AddToCartButton product={product} />

          {/* Payment info */}
          <div className="mt-5 p-4 bg-[#f0f7ff] rounded-lg border border-[#2196f3]/20">
            <p className="text-xs text-[#0d1b2a] font-semibold mb-1">How Payment Works</p>
            <p className="text-xs text-gray-600 leading-relaxed">
              Place your order and payment instructions will be emailed to you immediately after checkout.
            </p>
          </div>

          {/* Research disclaimer */}
          <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong>For Research Purposes Only.</strong> This product is not intended for human consumption.
              By purchasing, you confirm that you are a qualified researcher and will use this product
              in compliance with all applicable laws and regulations.
            </p>
          </div>
        </div>
      </div>

      {/* Content sections below the fold */}
      <div className="border-t border-gray-200 pt-10 space-y-10">

        {/* Description */}
        {product.description && (
          <section>
            <h2 className="text-sm font-bold text-[#0d1b2a] tracking-widest uppercase mb-3">
              Description
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              {product.description}
            </p>
          </section>
        )}

        {/* Additional Info */}
        {product.additionalInfo && (
          <section>
            <h2 className="text-sm font-bold text-[#0d1b2a] tracking-widest uppercase mb-3">
              Additional Information
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              {product.additionalInfo}
            </p>
          </section>
        )}

        {/* Mechanisms of Action */}
        {product.mechanisms && product.mechanisms.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-[#0d1b2a] tracking-widest uppercase mb-4">
              {mechanismsLabel}
            </h2>
            <ul className="space-y-3">
              {product.mechanisms.map((item, i) => {
                const [label, ...rest] = item.split(': ')
                const hasLabel = rest.length > 0
                return (
                  <li key={i} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
                    <span className="text-[#2196f3] mt-0.5 flex-shrink-0">•</span>
                    <span>
                      {hasLabel ? (
                        <><strong className="text-[#0d1b2a]">{label}:</strong> {rest.join(': ')}</>
                      ) : item}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Tissue-Specific Effects (BPC-157, BPC tablets) */}
        {product.tissueEffects && product.tissueEffects.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-[#0d1b2a] tracking-widest uppercase mb-4">
              Tissue-Specific Effects
            </h2>
            <ul className="space-y-3">
              {product.tissueEffects.map((item, i) => {
                const [label, ...rest] = item.split(': ')
                const hasLabel = rest.length > 0
                return (
                  <li key={i} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
                    <span className="text-[#2196f3] mt-0.5 flex-shrink-0">•</span>
                    <span>
                      {hasLabel ? (
                        <><strong className="text-[#0d1b2a]">{label}:</strong> {rest.join(': ')}</>
                      ) : item}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Technical Data */}
        {product.technicalData && product.technicalData.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-[#0d1b2a] tracking-widest uppercase mb-3">
              Technical Data
            </h2>
            <ul className="space-y-1">
              {product.technicalData.map((item, i) => {
                const colonIdx = item.indexOf(':')
                if (colonIdx > 0 && colonIdx < 40) {
                  const key = item.substring(0, colonIdx)
                  const val = item.substring(colonIdx + 1).trim()
                  return (
                    <li key={i} className="text-sm text-gray-700">
                      <span className="font-semibold text-[#0d1b2a]">{key}:</span> {val}
                    </li>
                  )
                }
                return <li key={i} className="text-sm text-gray-700">{item}</li>
              })}
            </ul>
          </section>
        )}

        {/* Certificate of Analysis */}
        {product.coas && product.coas.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-[#0d1b2a] tracking-widest uppercase mb-3">
              Certificate of Analysis
            </h2>
            <ul className="space-y-2">
              {product.coas.map((coa, i) => (
                <li key={i}>
                  <a
                    href={coa.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[#2196f3] hover:text-[#1565c0] hover:underline transition-colors font-medium"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    {coa.text}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

      </div>
    </div>
    </>
  )
}
