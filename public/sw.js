// Forge Amino fulfillment PWA service worker — minimal-intercept edition.
//
// Earlier versions of this SW intercepted every fetch and applied either a
// cache-first or network-first strategy. While the /api/* path was skipped,
// the indirection was almost certainly responsible for the 'page renders
// stale data' bug Sean kept hitting — mixed-snapshot responses are the kind
// of thing you only see when something between the app and the network is
// applying its own caching/coalescing.
//
// This version installs the SW (so PWA install + push notifications still
// work) but does NOT register a fetch listener at all. Every HTTP request
// goes through the browser's normal network path with no SW indirection.
// Static asset caching is the browser's default content-hashed cache
// (which works perfectly for Next.js bundle filenames anyway).

const SW_VERSION = 'sw-v3-2026-05-04-no-intercept'

self.addEventListener('install', (event) => {
  // skipWaiting() forces the new SW to activate immediately, replacing any
  // older SW (like the previous fetch-intercepting version) the moment the
  // user reloads the page.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Purge ALL caches left behind by previous SW versions
    const names = await caches.keys()
    await Promise.all(names.map(n => caches.delete(n)))
    // Take control of every open tab/PWA window in this scope right away
    await self.clients.claim()
    // Tell the page to refresh so the user immediately sees the new behavior
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of clients) {
      try { c.postMessage({ type: 'sw-activated', version: SW_VERSION }) } catch {}
    }
  })())
})

// NO fetch listener. Every fetch goes through the browser's default network
// stack, respecting our endpoint's no-cache headers.

// Push notification handlers — these don't intercept fetches, they handle
// incoming pushes from web-push.
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} }
  catch { data = { title: 'New order', body: event.data?.text() || '' } }
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
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of all) {
      if (client.url.includes('/admin/') && 'focus' in client) return client.focus()
    }
    return self.clients.openWindow(url)
  })())
})
