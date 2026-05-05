// Forge Amino fulfillment PWA service worker.
// Minimal scope: just enough to satisfy installability requirements +
// cache the static page shell so the app opens instantly even offline.
// We deliberately do NOT cache /api/* responses — those must always be fresh.

const CACHE_NAME = 'fa-fulfillment-v1'
const STATIC_ASSETS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => null)  // never block install on cache failures
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Never intercept API calls — orders/update must always hit the network fresh.
  if (url.pathname.startsWith('/api/')) return

  // For navigations (HTML page loads), prefer network so the user always gets
  // the latest deployed shell. Fall back to cache if offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/admin/fulfillment').then(r => r || caches.match('/')))
    )
    return
  }

  // For static assets in our cache list, serve from cache then update in background.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      // Only cache successful same-origin GETs to avoid blowing up the cache
      if (req.method === 'GET' && res.ok && url.origin === self.location.origin) {
        const copy = res.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {})
      }
      return res
    }).catch(() => cached))
  )
})

// Push subscription handler stub — wired up in Phase 3
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'New order', body: event.data?.text() || '' } }
  const title = data.title || 'Forge Amino — New order'
  const options = {
    body:  data.body  || 'A new order needs fulfillment.',
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag:   data.tag || 'fa-order',
    data:  { url: data.url || '/admin/fulfillment' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/admin/fulfillment'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((all) => {
      // Focus an existing tab on the same origin if open; else open new
      for (const client of all) {
        if (client.url.includes('/admin/') && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
