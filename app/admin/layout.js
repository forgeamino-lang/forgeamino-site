// Admin area: staff-only login and tools. Keep it out of search results.
export const metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }) {
  return children
}
