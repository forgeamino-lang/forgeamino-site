import { unstable_cache } from 'next/cache'
import { createServerClient } from './supabase'

// The optional limited-time slide for the homepage offers carousel.
// site_config key `offer_slide` holds JSON; see parseHolidayOffer in
// lib/offers.js for the fields. Cached for 60 seconds.
export const getHolidayOfferRaw = unstable_cache(
  async () => {
    try {
      const supabase = createServerClient()
      const { data } = await supabase.from('site_config').select('value').eq('key', 'offer_slide').maybeSingle()
      return data?.value ?? null
    } catch {
      return null
    }
  },
  ['site_config_offer_slide'],
  { revalidate: 60 }
)
