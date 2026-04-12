export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/cart', '/checkout', '/order/'],
      },
    ],
    sitemap: 'https://www.forgeamino.us/sitemap.xml',
    host: 'https://www.forgeamino.us',
  }
}
