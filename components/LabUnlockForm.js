'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LabUnlockForm() {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function onSubmit(e) {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      const r = await fetch('/api/lab/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setErr(j.error || 'Invalid code')
        setLoading(false)
        return
      }
      // Success: let the server re-render /lab with the cookie.
      router.refresh()
    } catch {
      setErr('Network error')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="text"
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder="LAB-XXXXXX"
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="characters"
        className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227] transition-colors uppercase tracking-widest text-sm"
      />
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <button
        type="submit"
        disabled={loading || !code.trim()}
        className="w-full py-3 rounded-full text-xs font-bold tracking-widest uppercase bg-[#c9a227] text-[#0d1b2a] hover:bg-[#d4b233] disabled:bg-gray-700 disabled:text-gray-400 transition-colors"
      >
        {loading ? 'Unlocking…' : 'Unlock Lab'}
      </button>
    </form>
  )
}
