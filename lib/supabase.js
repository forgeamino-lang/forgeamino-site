import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with elevated permissions (for API routes only)
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Generate a unique, human-readable order number like FA-10482.
//
// Aug 2026 incident: the old version (`FA-` + a random 4-digit number,
// 1000-9999, no collision check) generated FA-3735 for a new order when
// QuickBooks already had an invoice with that exact DocNumber from a prior
// month. QBO rejects duplicate DocNumbers, so the invoice sync silently
// failed (caught + reported to Sentry) while the order itself went through
// -- the order existed in Supabase but had no matching QBO invoice.
//
// Fix: widen the number space (5 digits, 10000-99999 = 90,000 possible
// values instead of 9,000) and actively check for collisions before
// returning a candidate -- first against our own order history (cheap,
// always available), and optionally against QuickBooks' invoice DocNumbers
// via the `checkQbo` callback, since some historical/manually-created QBO
// invoices don't have a matching Supabase row and wouldn't be caught by
// the Supabase check alone (this is exactly what happened in the incident
// above -- FA-3735 wasn't in the orders table, but was already a QBO
// invoice DocNumber).
export async function generateOrderNumber(supabase, { checkQbo } = {}) {
  const MAX_ATTEMPTS = 8
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const num = Math.floor(10000 + Math.random() * 90000)
    const candidate = `FA-${num}`

    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', candidate)
      .maybeSingle()
    if (existing) continue

    if (checkQbo) {
      try {
        const collides = await checkQbo(candidate)
        if (collides) continue
      } catch (e) {
        // Best-effort only -- never let a QBO lookup failure (auth hiccup,
        // network blip, etc.) block order creation. The Supabase check
        // above already makes a collision very unlikely on its own.
        console.error('QBO order-number collision check failed (continuing anyway):', e?.message)
      }
    }

    return candidate
  }
  // Vanishingly unlikely with a 90,000-number space and two independent
  // checks -- but fail loudly rather than silently hand back a number that
  // might still collide.
  throw new Error('Could not generate a unique order number after multiple attempts')
}
