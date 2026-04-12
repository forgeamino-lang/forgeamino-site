import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: 'Forge Amino | Explore Research Peptides Today',
  description: 'Your source for high quality research peptides. Third party lab tested with 99%+ purity.',
}

export default function Home() {
  return (
    <div>
      {/* ── HERO ── */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
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
        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24 w-full">
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

      {/* ── COMING SOON ── */}
      <section className="bg-white py-12 md:py-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-start">
            <div>
              <h2 className="text-3xl font-black text-[#0d1b2a] uppercase leading-tight mb-6">
                Coming Soon!!
              </h2>
              <ul className="space-y-3 mb-6">
                {[
                  { name: 'NAD+', dose: '1000mg' },
                  { name: 'BPC157 (Oral)', dose: '500mcg' },
                  { name: 'MOTS-C', dose: '50mg' },
                  { name: 'PT141', dose: '10mg' },
                ].map((product) => (
                  <li key={product.name} className="text-[#0d1b2a] text-base">
                    <span className="font-semibold">{product.name}</span>{' '}
                    <span className="text-gray-500">{product.dose}</span>
                  </li>
                ))}
              </ul>
              <p className="text-gray-500 text-sm">Check back for more Research Product releases!!</p>
            </div>

            <div className="bg-[#0d1b2a] rounded-lg p-8 text-center flex flex-col justify-center">
              <p className="text-[#4fc3f7] text-xs font-bold tracking-widest uppercase mb-4">Currently Available</p>
              <h3 className="text-white font-black text-2xl uppercase mb-4">Shop All Products</h3>
              <p className="text-white/60 text-sm mb-8 leading-relaxed">
                Browse our full catalog of research peptides, all third-party lab tested for purity and potency.
              </p>
              <Link
                href="/shop"
                className="bg-[#2196f3] hover:bg-[#1976d2] text-white font-bold px-8 py-4 text-sm tracking-widest uppercase transition-colors rounded"
              >
                Shop Now
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
