import './globals.css'
import { CartProvider } from '../components/CartContext'
import Header from '../components/Header'
import Link from 'next/link'
import { Toaster } from 'react-hot-toast'

const BASE_URL = 'https://www.forgeamino.us'

export const metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Forge Amino | Research Peptides',
    template: '%s | Forge Amino',
  },
  description: 'High-quality research peptides from Forge Amino. Every compound is independently third-party tested in a US laboratory with verified 99%+ purity. For research purposes only.',
  keywords: ['research peptides', 'BPC-157', 'TB-500', 'CJC-1295', 'Ipamorelin', 'Semaglutide', 'peptide supplier', 'third party tested peptides'],
  authors: [{ name: 'Forge Amino' }],
  creator: 'Forge Amino',
  publisher: 'Forge Amino',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    siteName: 'Forge Amino',
    title: 'Forge Amino | Research Peptides',
    description: 'High-quality research peptides independently third-party tested in a US laboratory with verified 99%+ purity.',
    images: [
      {
        url: '/hero-bg.jpg',
        width: 1200,
        height: 630,
        alt: 'Forge Amino Research Peptides',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Forge Amino | Research Peptides',
    description: 'High-quality research peptides independently third-party tested in a US laboratory with verified 99%+ purity.',
    images: ['/hero-bg.jpg'],
  },
  alternates: {
    canonical: BASE_URL,
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <Header />
          <main className="min-h-screen">
            {children}
          </main>
          <footer className="bg-[#0d1b2a] text-white py-12">
            <div className="max-w-4xl mx-auto px-6 text-center">
              <p className="font-bold tracking-widest text-lg mb-1">FORGE AMINO</p>
              <p className="text-[#4fc3f7] text-xs tracking-widest mb-8">RESEARCH PEPTIDES</p>
              <div className="space-y-4 mb-8">
                <p className="text-gray-400 text-xs leading-relaxed">
                  All products made available on this website are intended exclusively for research and development purposes and are strictly not for human consumption or therapeutic use. These products are not approved by the U.S. Food and Drug Administration (FDA), and no statements on this website have been evaluated by the FDA. The products and any information provided are not intended to diagnose, treat, cure, or prevent any disease or medical condition.
                </p>
                <p className="text-gray-400 text-xs leading-relaxed">
                  By purchasing from Forge Amino, the buyer acknowledges and agrees that all products are supplied solely for lawful research use and are not intended for human or animal consumption, or for use in any diagnostic or therapeutic procedures.
                </p>
                <p className="text-gray-400 text-xs leading-relaxed">
                  The purchaser assumes full responsibility and liability for the use, handling, storage, and distribution of all materials, and agrees to indemnify, defend, and hold harmless Forge Amino from any and all claims, damages, losses, or liabilities arising from misuse, unauthorized use, or failure to comply with applicable laws and regulations.
                </p>
              </div>
              <div className="flex justify-center gap-6 flex-wrap mb-6">
                <Link href="/disclaimers" className="text-gray-400 hover:text-[#4fc3f7] text-xs tracking-wide transition-colors">
                  Disclaimers
                </Link>
                <Link href="/privacy-policy" className="text-gray-400 hover:text-[#4fc3f7] text-xs tracking-wide transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/terms-of-use" className="text-gray-400 hover:text-[#4fc3f7] text-xs tracking-wide transition-colors">
                  Terms of Use
                </Link>
              </div>
              <p className="text-gray-600 text-xs">© {new Date().getFullYear()} Forge Amino. All rights reserved.</p>
            </div>
          </footer>
          <Toaster position="bottom-right" />
        </CartProvider>
      </body>
    </html>
  )
}
