import './globals.css'
import { CartProvider } from '../components/CartContext'
import Header from '../components/Header'
import { Toaster } from 'react-hot-toast'

export const metadata = {
  title: 'Forge Amino | Research Peptides',
  description: 'Explore research peptides from Forge Amino. For research purposes only.',
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
          <footer className="bg-[#0d1b2a] text-white py-10 mt-16">
            <div className="max-w-7xl mx-auto px-6 text-center">
              <p className="font-bold tracking-widest text-lg mb-1">FORGE AMINO</p>
              <p className="text-[#4fc3f7] text-xs tracking-widest mb-4">RESEARCH PEPTIDES</p>
              <p className="text-gray-400 text-xs">
                All products are for research purposes only. Not for human consumption.<br />
                © {new Date().getFullYear()} Forge Amino. All rights reserved.
              </p>
            </div>
          </footer>
          <Toaster position="bottom-right" />
        </CartProvider>
      </body>
    </html>
  )
}
