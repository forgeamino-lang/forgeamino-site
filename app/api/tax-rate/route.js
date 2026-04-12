import { NextResponse } from 'next/server'
import { getTaxRate } from '../../../lib/tax'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const zip   = searchParams.get('zip')?.trim()
  const city  = searchParams.get('city')?.trim()
  const state = searchParams.get('state')?.trim()

  if (!zip || !state) {
    return NextResponse.json({ error: 'zip and state are required' }, { status: 400 })
  }

  // If no API key is configured, fall back to state-only rate
  if (!process.env.TAXJAR_API_KEY) {
    const stateRate = getTaxRate(state)
    return NextResponse.json({
      zip, state, city,
      state_rate: stateRate.toFixed(4),
      county: null,
      county_rate: '0',
      city_rate: '0',
      combined_district_rate: '0',
      combined_rate: stateRate.toFixed(4),
      fallback: true,
    })
  }

  try {
    const params = new URLSearchParams({ country: 'US', state })
    if (city) params.set('city', city)

    const res = await fetch(
      `https://api.taxjar.com/v2/rates/${encodeURIComponent(zip)}?${params}`,
      {
        headers: {
          Authorization: `Token ${process.env.TAXJAR_API_KEY}`,
          'Content-Type': 'application/json',
        },
        // Don't cache — always get the live rate
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      // TaxJar returned an error — fall back to state rate
      console.error(`TaxJar API error: ${res.status} ${res.statusText}`)
      const stateRate = getTaxRate(state)
      return NextResponse.json({
        zip, state, city,
        state_rate: stateRate.toFixed(4),
        county: null,
        county_rate: '0',
        city_rate: '0',
        combined_district_rate: '0',
        combined_rate: stateRate.toFixed(4),
        fallback: true,
      })
    }

    const data = await res.json()
    return NextResponse.json(data.rate)
  } catch (err) {
    console.error('TaxJar fetch failed:', err)
    // Network error — fall back to state rate
    const stateRate = getTaxRate(state)
    return NextResponse.json({
      zip, state, city,
      state_rate: stateRate.toFixed(4),
      county: null,
      county_rate: '0',
      city_rate: '0',
      combined_district_rate: '0',
      combined_rate: stateRate.toFixed(4),
      fallback: true,
    })
  }
}
