import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: 'Forge Amino | Explore Research Peptides Today',
  description: 'Your source for high quality research peptides. Third party lab tested with 99%+ purity.',
}

export default function Home() {
  return (
    <main>
      {/* ── HERO ── */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.squarespace-cdn.com/content/v1/6977c149e6a06b672ff85de5/9daf5f19-19db-4b7d-bacd-0795b3690472/Forge-Amino-Hero-2.jpg"
            alt="Forge Amino Hero"
            fill
            className="object-cover object-center"
            priority
          />
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-[#0d1b2a]/60" />
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 w-full">
          {/* Feature badges */}
          <div className="flex flex-wrap gap-3 mb-8">
            {['THIRD PARTY LAB TESTED', 'FAST AND RELIABLE SHIPPING', 'FREE SHIPPING ON $250+ ORDERS'].map((badge) => (
              <span
                key={badge}
                className="bg-[#2196f3]/20 border border-[#4fc3f7] text-[#4fc3f7] text-xs font-bold tracking-widest px-4 py-2 rounded-full"
              >
                {badge}
              </span>
            ))}
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl font-black text-white uppercase leading-tight tracking-tight mb-6">
            Your Source For<br />
            <span className="text-[#4fc3f7]">High Quality</span><br />
            Research Peptides
          </h1>

          {/* Body text */}
          <p className="text-white/80 text-lg max-w-2xl mb-10 leading-relaxed">
            At Forge Amino, every compound undergoes stringent independent 3rd party testing
            in a US laboratory with verified 99%+ purity and QR link to the COA stamped on the vial.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-4">
            <Link
              href="/shop"
              className="bg-[#2196f3] hover:bg-[#1976d2] text-white font-bold px-8 py-4 rounded text-sm tracking-widest uppercase transition-colors"
            >
              Shop Now
            </Link>
            <Link
              href="/shop"
              className="border-2 border-white/60 hover:border-white text-white font-bold px-8 py-4 rounded text-sm tracking-widest uppercase transition-colors"
            >
              View All Products
            </Link>
          </div>
        </div>
      </section>

      {/* ── TRUST BADGES ── */}
      <section className="bg-[#0d1b2a] py-12 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#2196f3]/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-[#4fc3f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-white font-bold text-sm tracking-widest uppercase">Third Party Lab Tested</h3>
              <p className="text-white/60 text-sm">Independent US laboratory testing with verified 99%+ purity</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#2196f3]/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-[#4fc3f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-white font-bold text-sm tracking-widest uppercase">Fast & Reliable Shipping</h3>
              <p className="text-white/60 text-sm">Orders processed quickly with tracking on every shipment</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#2196f3]/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-[#4fc3f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-white font-bold text-sm tracking-widest uppercase">Free Shipping on $250+</h3>
              <p className="text-white/60 text-sm">Complimentary shipping on all qualifying orders</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ABOUT / COA SECTION ── */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-[#2196f3] text-xs font-bold tracking-widest uppercase mb-3">Our Standard</p>
              <h2 className="text-3xl font-black text-[#0d1b2a] uppercase leading-tight mb-6">
                Purity You Can<br />Verify
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                At Forge Amino, every compound undergoes stringent independent 3rd party testing
                in a US laboratory with verified 99%+ purity and QR link to the COA stamped on the vial.
              </p>
              <ul className="space-y-3">
                {[
                  'QR code on every vial links to certificate of analysis',
                  'Independent US laboratory verification',
                  '99%+ purity guaranteed on all compounds',
                  'For research purposes only',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-700 text-sm">
                    <span className="text-[#2196f3] mt-0.5 shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/shop"
                className="inline-block mt-8 bg-[#0d1b2a] hover:bg-[#1a2f45] text-white font-bold px-8 py-3 text-sm tracking-widest uppercase transition-colors"
              >
                Shop All Products
              </Link>
            </div>
            <div className="relative">
              <Image
                src="https://images.squarespace-cdn.com/content/v1/6977c149e6a06b672ff85de5/cc3c831d-44e2-4425-9cf7-9674b7003297/Forge-Amino-Logos-01.png"
                alt="Forge Amino Lab Tested"
                width={500}
                height={400}
                className="w-full object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── COMING SOON ── */}
      <section className="bg-[#f4f6f9] py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-[#2196f3] text-xs font-bold tracking-widest uppercase mb-3">New Releases</p>
              <h2 className="text-3xl font-black text-[#0d1b2a] uppercase leading-tight mb-6">
                Coming Soon!!
              </h2>
              <p className="text-gray-500 text-sm mb-8">Check back for more Research Product releases!!</p>
              <ul className="space-y-4">
                {[
                  { name: 'NAD+', dose: '1000mg' },
                  { name: 'BPC157 (Oral)', dose: '500mcg' },
                  { name: 'MOTS-C', dose: '50mg' },
                  { name: 'PT141', dose: '10mg' },
                ].map((product) => (
                  <li
                    key={product.name}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded px-5 py-4"
                  >
                    <span className="font-bold text-[#0d1b2a] uppercase tracking-wide text-sm">{product.name}</span>
                    <span className="text-[#2196f3] font-semibold text-sm">{product.dose}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#0d1b2a] rounded-lg p-8 text-center">
              <p className="text-[#4fc3f7] text-xs font-bold tracking-widest uppercase mb-4">Currently Available</p>
              <h3 className="text-white font-black text-2xl uppercase mb-6">19 Products In Stock</h3>
              <p className="text-white/60 text-sm mb-8">
                Browse our full catalog of research peptides, all third-party lab tested for purity and potency.
              </p>
              <Link
                href="/shop"
                className="block bg-[#2196f3] hover:bg-[#1976d2] text-white font-bold px-8 py-4 text-sm tracking-widest uppercase transition-colors rounded"
              >
                Shop Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── DISCLAIMER ── */}
      <section className="bg-[#0d1b2a] py-8 border-t border-white/10">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-white/40 text-xs leading-relaxed max-w-3xl mx-auto">
            All products sold by Forge Amino are intended for research purposes only and are not intended for human consumption.
            These statements have not been evaluated by the Food and Drug Administration.
            Must be 18+ and a licensed researcher to purchase.
          </p>
        </div>
      </section>
    </main>
  )
}
