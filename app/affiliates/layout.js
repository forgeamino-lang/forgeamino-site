// Affiliate portal: partner login and dashboard. Keep it out of search results.
export const metadata = {
  title: 'Affiliate Portal',
  robots: { index: false, follow: false },
}

export default function AffiliatesLayout({ children }) {
  return children
}
