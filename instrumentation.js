// Auto-loaded by Next.js on server boot (requires experimental.instrumentationHook
// in next.config.js for Next 14). Branches on NEXT_RUNTIME so we only load
// the relevant Sentry config per runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}
