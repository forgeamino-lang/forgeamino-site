import { NextResponse } from 'next/server'
import { getTaxRate } from '../../../lib/tax'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const zip   = searchParams.get('zip')?.trim()
  const city  = searchParams.get('city')?.trim()?.toUpperCase()
  const state = searchParams.get('state')?.trim()?.toUpperCase()
  const debug = searchParams.get('debug') === '1'

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

    // Pick the best result. Many ZIPs span multiple jurisdictions — e.g.
    // 73072 (Norman OK) returns two results, both labeled geoCity="NORMAN",
    // one in McClain County with no city tax (5% total) and one in Cleveland
    // County with Norman's 4.125% city tax (8.75% total). The taxing
    // jurisdiction that applies is the one inside city limits, which is always
    // the result with the highest taxSales among same-city matches.
    //
    // Strategy: highest-rate match, preferring city-name matches when the
    // client supplied a city. Falls back to highest-rate across all results
    // if no city match (or no city supplied).
    const byRate = (a, b) => (Number(b.taxSales) || 0) - (Number(a.taxSales) || 0)
    let result
    const cityMatches = city
      ? data.results.filter(r => r.geoCity?.toUpperCase() === city)
      : []
    if (cityMatches.length > 0) {
      result = [...cityMatches].sort(byRate)[0]
    } else {
      result = [...data.results].sort(byRate)[0]
    }

    // Normalise into the same shape the checkout & email code expects
    const normalized = {
      zip:                    result.geoPostalCode ?? zip,
      state:                  result.geoState      ?? state,
      city:                   result.geoCity        ?? city,
      county:                 result.geoCounty      ?? null,
      state_rate:             String(result.stateSalesTax  ?? 0),
      county_rate:            String(result.countySalesTax ?? 0),
      city_rate:              String(result.citySalesTax   ?? 0),
      combined_district_rate: String(result.districtSalesTax ?? 0),
      combined_rate:          String(result.taxSales        ?? 0),
    }
    if (debug) {
      // Unredacted zip-tax response so we can see every jurisdiction returned
      // for this ZIP and which one the picker chose. ?debug=1 only.
      normalized._debug = {
        rCode: data.rCode,
        resultCount: data.results?.length ?? 0,
        results: data.results,
        picked_index: data.results?.indexOf(result) ?? -1,
        picker_used: (city && data.results.some(r => r.geoCity?.toUpperCase() === city))
          ? 'highest-rate among city matches'
          : 'highest-rate across all results',
      }
    }
    return NextResponse.json(normalized)
  } catch (err) {
    console.error('zip.tax fetch failed:', err)
    return stateFallback()
  }
}
