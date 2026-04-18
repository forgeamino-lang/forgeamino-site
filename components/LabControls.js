'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LabControls() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function lock() {
    setLoading(true)
    try {
      await fetch('/api/lab/lock', { method: 'POST' })
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
