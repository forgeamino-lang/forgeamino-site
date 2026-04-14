import { PRODUCTS } from '../lib/products'

const BASE_URL = 'https://www.forgeamino.com'

export default function sitemap() {
    const staticPages = [
      {
              url: BASE_URL,
              lastModified: new Date(),
              changeFrequency: 'weekly',
              priority: 1.0,
      },
      {
              url: `${BASE_URL}/shop`,
              lastModified: new Date(),
              changeFrequency: 'weekly',
              priority: 0.9,
      },
      {
              url: `${BASE_URL}/contact`,
              lastModified: new Date(),
              changeFrequency: 'monthly',
              priority: 0.5,
      },
        ]

  const productPages = PRODUCTS.map((product) => ({
        url: `${BASE_URL}/shop/p/${product.slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: product.inStock ? 0.8 : 0.4,
  }))

  return [...staticPages, ...productPages]
}
