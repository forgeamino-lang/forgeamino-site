'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from './CartContext'

export default function LabControls() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { purgeHiddenItems } = useCart()

  async function lock() {
    setLoading(true)
    try {
      await fetch('/api/lab/lock', { method: 'POST' })
      // Purge hidden (Lab-only) items from the cart so they don't silently
      // 401 at checkout once the Lab session is locked.
      purgeHiddenItems()
    } finally {
      router.refresh()
    }
  }

  return (
    <button
      onClick={lock}
      disabled={loading}
      className="text-xs font-bold tracking-widest uppercase text-gray-400 hover:text-[#0d1b2a] transition-colors disabled:opacity-50"
    >
      {loading ? 'Locking…' : 'Lock Lab'}
    </button>
  )
}
