/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Required in Next 14 for instrumentation.js to load (loads Sentry).
    // Stabilized in Next 15 — remove this flag when we upgrade.
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.squarespace-cdn.com',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  async redirects() {
    // Certificate of Analysis PDF redirects
    // These /s/ short-URLs are encoded in QR codes printed on physical product vials.
    // After forgeamino.com DNS moves to Vercel, these redirects ensure every QR code
    // keeps working by forwarding to the Squarespace CDN where the PDFs are hosted.
    // TODO: once PDFs are migrated to Vercel /public/coas/, update destinations and flip permanent: true
    return [
      {
        source: '/s/FA-BPTB012601.pdf',
        destination: '/coa/FA-BPTB012601.pdf',
        permanent: true,
      },
      {
        source: '/s/FA-BPTB022601.pdf',
        destination: '/coa/FA-BPTB022601.pdf',
        permanent: true,
      },
      {
        source: '/s/FA-GLW012601.pdf',
        destination: '/coa/FA-GLW012601.pdf',
        permanent: true,
      },
      {
        source: '/s/FA-GLW022601.pdf',
        destination: '/coa/FA-GLW022601.pdf',
        permanent: true,
      },
      {
        source: '/s/FA-CJCIP022601.pdf',
        destination: '/coa/FA-CJCIP022601.pdf',
        permanent: true,
      },
      {
        source: '/s/COA-CJCIPA-FA-032601.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69d314cb90cd661342d207fc/1775441099067/COA+CJC%3AIPA+FA-032601.pdf',
        permanent: false,
      },
      {
        source: '/s/FA-MOT012601.pdf',
        destination: '/coa/FA-MOT012601.pdf',
        permanent: true,
      },
      {
        // Stale Squarespace asset-hash variant of the MOT012601 COA URL
        // (showed as a 404 in Search Console). Recover it to the local copy
        // so any old QR codes / links keep resolving.
        source: '/s/FA-MOT012601-gkt5.pdf',
        destination: '/coa/FA-MOT012601.pdf',
        permanent: false,
      },
      {
        source: '/s/FA-GHK012601.pdf',
        destination: '/coa/FA-GHK012601.pdf',
        permanent: true,
      },
      {
        source: '/s/FA-SLU022602.pdf',
        destination: '/coa/FA-SLU022602.pdf',
        permanent: true,
      },
      {
        source: '/s/FA-TSA012601.pdf',
        destination: '/coa/FA-TSA012601.pdf',
        permanent: true,
      },
      {
        source: '/s/COA-TESA-FA-032601.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69d314f9298d057c6ea98952/1775441145560/COA+TESA+FA-032601.pdf',
        permanent: false,
      },
      {
        source: '/s/FA-IPA012601.pdf',
        destination: '/coa/FA-IPA012601.pdf',
        permanent: true,
      },
      {
        source: '/s/COA-Ipa-FA-032601.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69d3149c298d057c6ea97107/1775441052944/COA+Ipa+FA-032601.pdf',
        permanent: false,
      },
      {
        source: '/s/FA-KLO022602.pdf',
        destination: '/coa/FA-KLO022602.pdf',
        permanent: true,
      },
      {
        source: '/s/FA-BPC022602.pdf',
        destination: '/coa/FA-BPC022602.pdf',
        permanent: true,
      },
      {
        source: '/s/FA-TB5022602.pdf',
        destination: '/coa/FA-TB5022602.pdf',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
