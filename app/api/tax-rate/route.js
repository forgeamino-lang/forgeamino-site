import { NextResponse } from 'next/server'
import { getTaxRate } from '../../../lib/tax'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const zip   = searchParams.get('zip')?.trim()
  const city  = searchParams.get('city')?.trim()?.toUpperCase()
  const state = searchParams.get('state')?.trim()?.toUpperCase()

  if (!zip || !state) {
    return NextResponse.json({ error: 'zip and state are required' }, { status: 400 })
  }

  // Fallback helper — uses our state-only table from lib/tax.js
  function stateFallback() {
    const stateRate = getTaxRate(state)
    return NextResponse.json({
      zip, state, city,
      state_rate:               stateRate.toFixed(4),
      county:                   null,
      county_rate:              '0',
      city_rate:                '0',
      combined_district_rate:   '0',
      combined_rate:            stateRate.toFixed(4),
      fallback:                 true,
    })
  }

  // If no API key configured, fall back immediately
  if (!process.env.ZIPTAX_API_KEY) {
    return stateFallback()
  }

  try {
    const params = new URLSearchParams({ postalcode: zip })

    const res = await fetch(
      `https://api.zip-tax.com/request/v60?${params}`,
      {
        headers: {
          'X-API-KEY':    process.env.ZIPTAX_API_KEY,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      console.error(`zip.tax API error: ${res.status} ${res.statusText}`)
      return stateFallback()
    }

    const data = await res.json()

    // rCode 100 = success, anything else = no results / error
    if (data.rCode !== 100 || !data.results?.length) {
      console.error(`zip.tax no results for zip ${zip}:`, data)
      return stateFallback()
    }

    // Pick the best result: prefer one matching the supplied city name,
    // otherwise use the first result (highest population / primary rate)
    let result = data.results[0]
    if (city && data.results.length > 1) {
      const cityMatch = data.results.find(
        r => r.geoCity?.toUpperCase() === city
      )
      if (cityMatch) result = cityMatch
    }

    // Normalise into the same shape the checkout & email code expects
    return NextResponse.json({
      zip:                    result.geoPostalCode ?? zip,
      state:                  result.geoState      ?? state,
      city:                   result.geoCity        ?? city,
      county:                 result.geoCounty      ?? null,
      state_rate:             String(result.stateSalesTax  ?? 0),
      county_rate:            String(result.countySalesTax ?? 0),
      city_rate:              String(result.citySalesTax   ?? 0),
      combined_district_rate: String(result.districtSalesTax ?? 0),
      combined_rate:          String(result.taxSales        ?? 0),
    })
  } catch (err) {
    console.error('zip.tax fetch failed:', err)
    return stateFallback()
  }
}
