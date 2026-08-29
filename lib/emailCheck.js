// Lightweight "did you mean...?" typo detector for the checkout email field.
// No external dependency, no network call — self-contained, inspired by the
// well-known mailcheck.js approach. Purely a soft UX warning; it never blocks
// submission, since it can't know for certain an unusual domain is wrong.

const COMMON_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'aol.com', 'live.com', 'msn.com', 'comcast.net', 'protonmail.com',
  'yahoo.co.uk', 'hotmail.co.uk', 'outlook.co.uk', 'me.com', 'mac.com',
  'att.net', 'verizon.net', 'sbcglobal.net', 'ymail.com', 'googlemail.com',
]

// If the domain isn't a near-miss of a known provider, we fall back to just
// sanity-checking the TLD against this list -- catches things like .coom,
// .con, .cmo, .comm on an otherwise-unrecognized domain without needing to
// guess what the "correct" domain should be.
const KNOWN_TLDS = new Set([
  'com', 'net', 'org', 'edu', 'gov', 'mil', 'io', 'co', 'us', 'info', 'biz',
  'me', 'name', 'pro', 'tv', 'cc', 'ca', 'uk', 'de', 'fr', 'es', 'it', 'nl',
  'au', 'nz', 'jp', 'cn', 'in', 'br', 'mx', 'ru', 'ch', 'se', 'no', 'dk',
  'fi', 'pl', 'pt', 'ie', 'be', 'at', 'za', 'sg', 'hk', 'kr', 'app', 'dev',
  'xyz', 'online', 'store', 'tech',
])

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[m][n]
}

/**
 * Given a raw email string typed at checkout, returns one of:
 *   null                              - looks fine (or too malformed to
 *                                        reason about -- native type="email"
 *                                        validation handles that case)
 *   { suggestion: 'name@gmail.com' }  - looks like a 1-2 character typo of a
 *                                        known provider domain
 *   { warning: true }                 - domain doesn't match a known
 *                                        provider AND its TLD isn't
 *                                        recognized (e.g. .coom, .con)
 */
export function suggestEmailCorrection(email) {
  const trimmed = (email || '').trim()
  const match = /^([^\s@]+)@([^\s@]+\.[^\s@]+)$/.exec(trimmed)
  if (!match) return null
  const [, local, domain] = match
  const domainLower = domain.toLowerCase()

  if (COMMON_DOMAINS.includes(domainLower)) return null

  let best = null
  let bestDist = Infinity
  for (const known of COMMON_DOMAINS) {
    const dist = levenshtein(domainLower, known)
    if (dist < bestDist) { bestDist = dist; best = known }
  }
  if (best && bestDist > 0 && bestDist <= 2) {
    return { suggestion: `${local}@${best}` }
  }

  const tld = domainLower.split('.').pop()
  if (!KNOWN_TLDS.has(tld)) {
    return { warning: true }
  }

  return null
}
