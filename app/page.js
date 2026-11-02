import Link from 'next/link'
import Image from 'next/image'
import { getHolidayOfferRaw } from '../lib/siteConfig'
import { buildOffers, parseHolidayOffer } from '../lib/offers'
import OffersCarousel from '../components/OffersCarousel'
import ProductCard from '../components/ProductCard'
import { getProductBySlug } from '../lib/products'

// Homepage best sellers (by units sold, last 90 days, public products only).
// Linking product pages straight from the homepage passes it authority to
// them, which helps Google crawl and rank them. Hidden, inactive or
// out-of-stock items drop out automatically.
const BEST_SELLER_SLUGS = [
  'wolverine-blend',
  'klow-blend',
  'cjc1295nodac-ipamorelin',
  'mots-c',
  'glow-blend',
  'nad-plus-1000mg',
  'glutathione-1500mg',
  'ghk-cu',
  'bpc-157',
]

export const metadata = {
  title: { absolute: 'Forge Amino | High-Quality Research Peptides' },
  description: 'Your source for high-quality research peptides. Every compound independently third-party tested in a US laboratory with verified 99%+ purity and QR-linked COA on each vial.',
  alternates: {
    canonical: 'https://www.forgeamino.com',
  },
  openGraph: {
    title: 'Forge Amino | High-Quality Research Peptides',
    description: 'Your source for high-quality research peptides. Every compound independently third-party tested in a US laboratory with verified 99%+ purity.',
    url: 'https://www.forgeamino.com',
  },
}

export default async function Home() {
  const offers = buildOffers(parseHolidayOffer(await getHolidayOfferRaw()))
  const bestSellers = BEST_SELLER_SLUGS
    .map(getProductBySlug)
    .filter(p => p && !p.hidden && p.inStock && p.price > 0)
  return (
    <div>
      {/* ── HERO ── */}
      <section className="relative min-h-[56vh] pb-20 sm:pb-24 flex items-center overflow-hidden">
        {/* Background image — served locally to avoid hotlink blocking */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero-bg.jpg"
            alt="Forge Amino Research Peptides"
            fill
            className="object-cover object-center"
            priority
          />
          {/* Very light overlay — keep the bright blue look of forgeamino.com */}
          <div className="absolute inset-0 bg-black/10" />
        </div>

        {/* Hero content — left-aligned, matching forgeamino.com */}
        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 pt-12 pb-6 sm:pt-12 sm:pb-4 w-full">
          <div className="max-w-xl">
            {/* Badge pills */}
            <div className="flex flex-wrap gap-2 mb-5">
              {['Third Party Lab Tested', 'Fast Shipping', 'Free Shipping on $250+'].map((badge) => (
                <span
                  key={badge}
                  className="border border-white/70 text-white text-xs font-semibold tracking-wide px-3 py-1.5 rounded-full whitespace-nowrap"
                >
                  {badge}
                </span>
              ))}
            </div>

            {/* Headline */}
            <p className="text-white text-sm sm:text-base font-light tracking-widest uppercase mb-2">
              Your Source For
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white uppercase leading-none tracking-tight mb-5">
              High Quality<br />
              Research<br />
              Peptides
            </h1>

            {/* Body text */}
            <p className="text-white/90 text-sm sm:text-base max-w-md mb-8 leading-relaxed">
              At Forge Amino, every compound undergoes stringent{' '}
              <span className="font-semibold">independent 3rd party testing in a US laboratory</span>{' '}
              with verified 99%+ purity and QR link to the COA stamped on the vial.
            </p>

            {/* CTA button */}
            <div className="flex flex-wrap gap-4">
              <Link
                href="/shop"
                className="bg-[#2196f3] hover:bg-[#1976d2] text-white font-bold px-8 py-4 text-sm tracking-widest uppercase transition-colors"
              >
                Shop Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── OFFERS CAROUSEL (overlaps the bottom of the hero) ── */}
      <OffersCarousel slides={offers} />

      {/* ── BEST SELLERS ── */}
      {bestSellers.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="flex items-end justify-between gap-4 mb-8 pb-4 border-b border-gray-200">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#0d1b2a] uppercase tracking-tight">
                Best Sellers
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Our most-ordered research peptides, each with batch COAs in our{' '}
                <Link href="/lab-results" className="text-[#2196f3] hover:underline">lab results library</Link>.
              </p>
            </div>
            <Link
              href="/shop"
              className="shrink-0 text-xs font-bold tracking-widest uppercase text-[#2196f3] hover:text-[#1976d2]"
            >
              View all &rarr;
            </Link>
          </div>
          <div className="product-grid">
            {bestSellers.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
