'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Detects the in-app browsers (and a couple of privacy browsers) that most
// often drop session cookies between requests, breaking our lab unlock.
// Returns { name } when matched, null otherwise. Wrapped at the call site
// in a try/catch so a regex bug can NEVER break the form for everyone else.
function detectRestrictedBrowser(ua) {
  if (!ua) return null
  const tests = [
    { name: 'Instagram',         re: /Instagram/i },
    { name: 'Facebook',          re: /\bFBAN\b|\bFBAV\b|\bFB_IAB\b|\bFB4A\b/i },
    { name: 'Messenger',         re: /Messenger/i },
    { name: 'Twitter (X)',       re: /Twitter for/i },
    { name: 'TikTok',            re: /musical_ly|BytedanceWebview|TikTok/i },
    { name: 'Snapchat',          re: /Snapchat/i },
    { name: 'LinkedIn',          re: /LinkedInApp/i },
    { name: 'Pinterest',         re: /Pinterest/i },
    { name: 'Reddit app',        re: /\bReddit\b/i },
    { name: 'WhatsApp',          re: /WhatsApp/i },
    { name: 'Line app',          re: /Line\//i },
    { name: 'WeChat',            re: /MicroMessenger/i },
    { name: 'Discord',           re: /Discord/i },
    { name: 'Slack',             re: /Slack/i },
    // Privacy browsers with aggressive defaults (Brave is detected separately)
    { name: 'DuckDuckGo',        re: /DuckDuckGo/i },
  ]
  for (const t of tests) {
    if (t.re.test(ua)) return { name: t.name }
  }
  return null
}

export default function LabUnlockForm() {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [restrictedBrowser, setRestrictedBrowser] = useState(null)
  const router = useRouter()

  // Detect restricted browser on mount. Wrapped so any failure here is silent
  // — the form renders normally even if detection blows up.
  useEffect(() => {
    try {
      const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : ''
      const restricted = detectRestrictedBrowser(ua)
      if (restricted) {
        setRestrictedBrowser(restricted)
        return
      }
      // Brave exposes navigator.brave.isBrave() — async probe
      if (typeof navigator !== 'undefined' && navigator.brave && typeof navigator.brave.isBrave === 'function') {
        navigator.brave.isBrave().then(isBrave => {
          if (isBrave) setRestrictedBrowser({ name: 'Brave' })
        }).catch(() => {})
      }
    } catch {
      // Never let a detection bug break the form.
    }
  }, [])

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
    <div className="space-y-3">
      {restrictedBrowser && (
        <div className="bg-amber-500/15 border border-amber-400/40 rounded-lg p-3 text-amber-100 text-xs leading-relaxed">
          <div className="font-bold uppercase tracking-wider mb-1 text-amber-300">
            ⚠ Open in your full browser
          </div>
          <p>
            You appear to be viewing this page inside <span className="font-bold">{restrictedBrowser.name}</span>.
            In-app browsers often block the cookies our lab unlock relies on. If you have trouble unlocking, tap the
            menu (<span className="font-mono">⋯</span> or <span className="font-mono">⋮</span>) and choose
            <span className="font-bold"> &ldquo;Open in Safari&rdquo;</span> or <span className="font-bold">&ldquo;Open in Chrome&rdquo;</span>,
            then enter your code there.
          </p>
        </div>
      )}

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
    </div>
  )
}
