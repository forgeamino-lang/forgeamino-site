import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: 'High-Quality Research Peptides',
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
{/* ── CUSTOM REQUEST BANNER ── */}
      <div className="bg-[#f0f7ff] border-y border-[#2196f3]/20 py-4">
                <div className="max-w-6xl mx-auto px-5 sm:px-8 flex items-center justify-center gap-3 text-center flex-wrap">
                  <span className="text-lg">💬</span>
          <p className="text-sm text-[#0d1b2a]">
                    <span className="font-bold">Don&apos;t see a product you&apos;re interested in?</span>{' '}
            We&apos;re happy to help source it —{' '}
            <Link href="/contact" className="text-[#2196f3] font-bold hover:underline">contact us →</Link>
              </p>
              </div>
              </div>

    </div>
  )
}
