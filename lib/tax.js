// State sales tax rates (base state rate — does not include county/city)
// Rates current as of 2025. 5 states have no sales tax (0%).
export const STATE_TAX_RATES = {
  AL: 0.04,
  AK: 0.00,   // No state sales tax
  AZ: 0.056,
  AR: 0.065,
  CA: 0.0725,
  CO: 0.029,
  CT: 0.0635,
  DE: 0.00,   // No sales tax
  FL: 0.06,
  GA: 0.04,
  HI: 0.04,
  ID: 0.06,
  IL: 0.0625,
  IN: 0.07,
  IA: 0.06,
  KS: 0.065,
  KY: 0.06,
  LA: 0.0445,
  ME: 0.055,
  MD: 0.06,
  MA: 0.0625,
  MI: 0.06,
  MN: 0.06875,
  MS: 0.07,
  MO: 0.04225,
  MT: 0.00,   // No sales tax
  NE: 0.055,
  NV: 0.0685,
  NH: 0.00,   // No sales tax
  NJ: 0.06625,
  NM: 0.05,
  NY: 0.04,
  NC: 0.0475,
  ND: 0.05,
  OH: 0.0575,
  OK: 0.045,
  OR: 0.00,   // No sales tax
  PA: 0.06,
  RI: 0.07,
  SC: 0.06,
  SD: 0.042,
  TN: 0.07,
  TX: 0.0625,
  UT: 0.0485,
  VT: 0.06,
  VA: 0.053,
  WA: 0.065,
  WV: 0.06,
  WI: 0.05,
  WY: 0.04,
  DC: 0.06,
}

/**
 * Get tax rate for a given state abbreviation (e.g. 'CA')
 * Returns 0 if state not found or has no sales tax
 */
export function getTaxRate(state) {
  return STATE_TAX_RATES[state?.toUpperCase()] ?? 0
}

/**
 * Calculate tax amount for a subtotal + state
 * Returns { taxRate, taxAmount } rounded to 2 decimal places
 */
export function calculateTax(state, subtotal) {
  const taxRate = getTaxRate(state)
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100
  return { taxRate, taxAmount }
}

/**
 * Format tax rate as a percentage string (e.g. "7.25%")
 */
export function formatTaxRate(rate) {
  return `${(rate * 100).toFixed(2).replace(/\.00$/, '')}%`
}
