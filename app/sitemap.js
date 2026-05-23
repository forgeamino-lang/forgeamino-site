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

  // Only shop-visible products. Hidden Lab / prescription items are
  // intentionally excluded so Google does not index restricted pages.
  const productPages = PRODUCTS.filter((product) => !product.hidden).map((product) => ({
        url: `${BASE_URL}/shop/p/${product.slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: product.inStock ? 0.8 : 0.4,
  }))

  return [...staticPages, ...productPages]
}
