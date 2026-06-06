import { unstable_cache } from 'next/cache'
import { createServerClient } from './supabase'

// Reads site_config.sale_active from Supabase.
// Cached for 60 seconds so activation propagates quickly without hammering the DB.
export const getSaleActive = unstable_cache(
  async () => {
    try {
      const supabase = createServerClient()
      const { data } = await supabase
        .from('site_config')
        .select('value')
        .eq('key', 'sale_active')
        .single()
      return data?.value === 'true'
    } catch {
      return false
    }
  },
  ['site_config_sale_active'],
  { revalidate: 60 }
)
