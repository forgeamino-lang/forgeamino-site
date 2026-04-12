/** @type {import('next').NextConfig} */
const nextConfig = {
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
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69a25e00d1260a6f9f529533/1772248576872/FA-BPTB012601.pdf',
        permanent: false,
      },
      {
        source: '/s/FA-BPTB022601.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69a25db3e2528e7e710e873c/1772248499664/FA-BPTB022601.pdf',
        permanent: false,
      },
      {
        source: '/s/FA-GLW012601.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69a2605bb02a574b3424fdd0/1772249179783/FA-GLW012601.pdf',
        permanent: false,
      },
      {
        source: '/s/FA-GLW022601.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69a25d5c2407e06c9c50c3fb/1772248412826/FA-GLW022601.pdf',
        permanent: false,
      },
      {
        source: '/s/FA-CJCIP022601.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69a25e4b6f77231f19ba8b53/1772248651614/FA-CJCIP022601.pdf',
        permanent: false,
      },
      {
        source: '/s/COA-CJCIPA-FA-032601.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69d314cb90cd661342d207fc/1775441099067/COA+CJC%3AIPA+FA-032601.pdf',
        permanent: false,
      },
      {
        source: '/s/FA-MOT012601.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69a25f454b2f6f041d60208a/1772248901689/FA-MOT012601.pdf',
        permanent: false,
      },
      {
        source: '/s/FA-GHK012601.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69a25fa4103c8e127e169029/1772248996959/FA-GHK012601.pdf',
        permanent: false,
      },
      {
        source: '/s/FA-SLU022602.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69a36fe4d1260a6f9f73aca6/1772318692581/FA-SLU022602.pdf',
        permanent: false,
      },
      {
        source: '/s/FA-TSA012601.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69a25ee12407e06c9c50dfa1/1772248801106/FA-TSA012601.pdf',
        permanent: false,
      },
      {
        source: '/s/COA-TESA-FA-032601.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69d314f9298d057c6ea98952/1775441145560/COA+TESA+FA-032601.pdf',
        permanent: false,
      },
      {
        source: '/s/FA-IPA012601.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69a25efcd1260a6f9f52b3f5/1772248828764/FA-IPA012601.pdf',
        permanent: false,
      },
      {
        source: '/s/COA-Ipa-FA-032601.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69d3149c298d057c6ea97107/1775441052944/COA+Ipa+FA-032601.pdf',
        permanent: false,
      },
      {
        source: '/s/FA-KLO022602.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69a2fb5fdadbcd7b0e505d45/1772288863384/FA-KLO022602.pdf',
        permanent: false,
      },
      {
        source: '/s/FA-BPC022602.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69a3a4a6db7e723b297e76c6/1772332198804/FA-BPC022602.pdf',
        permanent: false,
      },
      {
        source: '/s/FA-TB5022602.pdf',
        destination: 'https://static1.squarespace.com/static/6977c149e6a06b672ff85de5/t/69a3a1bf21f9693ed8b29335/1772331455061/FA-TB5022602.pdf',
        permanent: false,
      },
    ]
  },
}

module.exports = nextConfig
