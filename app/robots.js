export default function robots() {
    return {
          rules: [
            {
                      userAgent: '*',
                      allow: '/',
                      disallow: ['/api/', '/cart', '/checkout', '/order/'],
            },
                ],
          sitemap: 'https://www.forgeamino.com/sitemap.xml',
          host: 'https://www.forgeamino.com',
    }
}
