import * as Sentry from '@sentry/nextjs'

// Server-runtime Sentry init. No DSN => enabled:false => zero-cost no-op.
// Set SENTRY_DSN in Vercel (Production + Preview) to turn alerts on.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  // We only care about errors right now, not perf traces.
  tracesSampleRate: 0,
  // Tag the environment so prod alerts are distinguishable from preview noise.
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
  // Keep payloads small — we add extras at the captureException call site.
  initialScope: {
    tags: { service: 'forgeamino-site' },
  },
})
