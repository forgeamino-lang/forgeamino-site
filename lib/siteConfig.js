import { unstable_cache } from 'next/cache'
import { createServerClient } from './supabase'

// Reads site_config.sale_active (and, if present, site_config.sale_ends_at)
// from Supabase to decide whether sale banners/graphics should render.
//
// sale_active   — manual on/off switch, set by a human.
// sale_ends_at  — optional ISO timestamp. Once now() passes this, the sale
//                 is treated as inactive regardless of sale_active, so a
//                 sale can be scheduled to come down automatically (e.g. at
//                 midnight) without anyone needing to flip sale_active by
//                 hand at that exact time. Leave sale_ends_at unset for a
//                 sale with no fixed end time.
//
// Cached for 60 seconds so activation/deactivation propagates quickly
// without hammering the DB.
export const getSaleActive = unstable_cache(
  async () => {
    try {
      const supabase = createServerClient()
      const { data } = await supabase
        .from('site_config')
        .select('key, value')
        .in('key', ['sale_active', 'sale_ends_at'])

      const config = Object.fromEntries((data || []).map((row) => [row.key, row.value]))

      if (config.sale_active !== 'true') return false

      if (config.sale_ends_at) {
        const endsAt = new Date(config.sale_ends_at).getTime()
        if (Number.isFinite(endsAt) && Date.now() >= endsAt) {
          return false
        }
      }

      return true
    } catch {
      return false
    }
  },
  ['site_config_sale_active'],
  { revalidate: 60 }
)
