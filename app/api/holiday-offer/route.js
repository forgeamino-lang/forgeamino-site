import { NextResponse } from 'next/server'
import { getHolidayOfferRaw } from '../../../lib/siteConfig'
import { parseHolidayOffer } from '../../../lib/offers'

// The live holiday offer (or null), for the site-wide sale banner.
// Re-checked on every request against starts_at/ends_at; the underlying
// site_config read is cached for 60 seconds.
export const dynamic = 'force-dynamic'

export async function GET() {
  const offer = parseHolidayOffer(await getHolidayOfferRaw())
  return NextResponse.json(
    { offer },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' } }
  )
}
