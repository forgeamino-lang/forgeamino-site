import * as Sentry from '@sentry/nextjs'

// Edge-runtime Sentry init (middleware.js runs on edge).
// No DSN => enabled:false => zero-cost no-op.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 0,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
  initialScope: {
    tags: { service: 'forgeamino-site', runtime: 'edge' },
  },
})
