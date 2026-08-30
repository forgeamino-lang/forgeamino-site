import { getSaleActive } from '../lib/siteConfig'

export default async function SaleBanner() {
  const saleActive = await getSaleActive()
  if (!saleActive) return null
  return (
    <div
      style={{
        backgroundImage:
          'radial-gradient(circle, rgba(255,255,255,0.35) 1px, transparent 1.5px), linear-gradient(90deg, #B22234 0%, #0A1F44 50%, #B22234 100%)',
        backgroundSize: '18px 18px, 100% 100%',
      }}
      className="w-full py-2.5 px-4 text-center text-white text-sm font-semibold tracking-wide border-y-2 border-white/30"
    >
      {'🇺🇸'} LABOR DAY SALE — Use code{' '}
      <span
        style={{ background: '#ffffff', color: '#B22234' }}
        className="inline-block font-black px-2.5 py-0.5 rounded-full text-xs tracking-widest mx-1 border border-[#0A1F44]"
      >
        LABORDAY30
      </span>
      {' '}for <strong>30% off</strong> your entire order
    </div>
  )
}
