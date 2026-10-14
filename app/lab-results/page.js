import Link from 'next/link'
import { PRODUCTS } from '../../lib/products'

const BASE_URL = 'https://www.forgeamino.com'
const PAGE_URL = `${BASE_URL}/lab-results`

export const metadata = {
  title: 'Lab Results & Certificates of Analysis',
  description: 'Every published Certificate of Analysis for Forge Amino research peptides, organized by product and batch. Independent third-party testing in US laboratories.',
  alternates: { canonical: PAGE_URL },
}

// Batches whose COA has not been published yet carry "(Coming Soon)" in their
// label (see lib/products.js); they are left off this page until the real
// certificate is posted.
const isPublished = coa => !/coming soon/i.test(coa.text)

const batchLabel = coa =>
  coa.text.replace(/^View Certificate of Analysis\s*[–-]\s*/i, '').trim()

const fileType = href => (href.split('.').pop() || 'pdf').toUpperCase()

export default function LabResultsPage() {
  // Shop products only: hidden Lab items are never listed publicly.
  const groups = PRODUCTS
    .filter(p => !p.hidden)
    .map(p => ({ product: p, coas: (p.coas || []).filter(isPublished) }))
    .filter(g => g.coas.length > 0)
    .sort((a, b) => a.product.name.localeCompare(b.product.name))

  const totalCoas = groups.reduce((n, g) => n + g.coas.length, 0)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Forge Amino Lab Results & Certificates of Analysis',
    url: PAGE_URL,
    publisher: { '@id': `${BASE_URL}/#organization` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: groups.length,
      itemListElement: groups.map((g, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: g.product.name,
        url: `${BASE_URL}/shop/p/${g.product.slug}`,
      })),
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1">
          <Link href="/" className="hover:text-[#2196f3] transition-colors">Home</Link>
          <span>›</span>
          <span className="text-[#0d1b2a]">Lab Results</span>
        </nav>

        <h1 className="text-2xl sm:text-3xl font-bold text-[#0d1b2a] tracking-wider uppercase mb-4">
          Lab Results &amp; Certificates of Analysis
        </h1>

        <div className="space-y-4 text-sm text-gray-700 leading-relaxed mb-8">
          <p>
            Every Forge Amino batch is independently tested by a third-party laboratory in the
            United States, and the full Certificate of Analysis (COA) is published here as soon
            as results are in. Each vial or bottle carries a QR code that links straight to the COA
            for its own batch, so the results you read match the material you receive.
          </p>
          <p>
            This page lists all {totalCoas} published certificates across {groups.length} products.
            Our testing partners are Freedom Diagnostics Testing, Kovera Labs
            and BT Labs.
          </p>
        </div>

        <section className="mb-10 p-5 bg-[#f0f7ff] rounded-lg border border-[#2196f3]/20">
          <h2 className="text-sm font-bold text-[#0d1b2a] tracking-widest uppercase mb-3">
            What a Certificate Shows
          </h2>
          <ul className="space-y-2 text-sm text-gray-700 leading-relaxed">
            <li><strong className="text-[#0d1b2a]">Purity:</strong> HPLC analysis of the sample, reported as a percentage.</li>
            <li><strong className="text-[#0d1b2a]">Identity:</strong> confirmation that the compound is what the label says (LC-MS or FTIR, depending on the lab).</li>
            <li><strong className="text-[#0d1b2a]">Net content:</strong> on most reports, the measured amount of peptide in the vial compared with the labeled amount.</li>
            <li><strong className="text-[#0d1b2a]">Endotoxin:</strong> many recent reports also include LAL endotoxin screening.</li>
          </ul>
          <p className="text-xs text-gray-500 mt-3">
            Methods vary by laboratory and report. Open any certificate for its full methods and results.
          </p>
        </section>

        <div className="space-y-6">
          {groups.map(({ product, coas }) => (
            <section key={product.slug} className="border-b border-gray-200 pb-6">
              <h2 className="text-base font-bold text-[#0d1b2a] mb-3">
                <Link href={`/shop/p/${product.slug}`} className="hover:text-[#2196f3] transition-colors">
                  {product.name}
                </Link>
              </h2>
              <ul className="flex flex-wrap gap-2">
                {coas.map(coa => (
                  <li key={coa.href}>
                    <a
                      href={coa.href}
                      target="_blank"
                      rel="noopener"
                      className="inline-block px-3 py-1.5 text-xs font-medium rounded border border-gray-300 text-[#0d1b2a] hover:border-[#2196f3] hover:text-[#2196f3] transition-colors"
                    >
                      {batchLabel(coa)} ({fileType(coa.href)})
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="text-xs text-gray-500 leading-relaxed mt-10">
          All products are sold strictly for laboratory research use and are not for human
          consumption. Certificates report results for the tested sample of each batch.
        </p>
      </div>
    </>
  )
}
