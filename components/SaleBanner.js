import { getSaleActive } from '../lib/siteConfig'

export default async function SaleBanner() {
  const saleActive = await getSaleActive()
  if (!saleActive) return null
  return (
    <div style={{ background: '#FF1F6E' }} className="w-full py-2.5 px-4 text-center text-white text-sm font-semibold tracking-wide">
      {'\ud83d\udd25'} Start of Summer Sale — Use code{' '}
      <span
        style={{ background: '#AAFF00', color: '#1a3300' }}
        className="inline-block font-black px-2.5 py-0.5 rounded-full text-xs tracking-widest mx-1"
      >
        SUMMER15
      </span>
      {' '}for <strong>15% off</strong> your entire order
    </div>
  )
}
