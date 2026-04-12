'use client'

import { useState } from 'react'
import { Mail, Send, CheckCircle } from 'lucide-react'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('')

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong. Please try again.')
        setStatus('error')
      } else {
        setStatus('success')
      }
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle size={56} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-[#0d1b2a] mb-3 tracking-wide uppercase">Message Sent!</h1>
        <p className="text-gray-600 mb-2">Thanks for reaching out. We'll get back to you within 1–2 business days.</p>
        <p className="text-sm text-gray-400 mb-8">A confirmation has been sent to <strong>{form.email}</strong>.</p>
        <button
          onClick={() => { setForm({ name: '', email: '', subject: '', message: '' }); setStatus('idle') }}
          className="inline-block bg-[#0d1b2a] text-white px-8 py-3 rounded-full font-bold tracking-widest uppercase text-sm hover:bg-[#1a2e45] transition-colors"
        >
          Send Another Message
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {/* Header */}
      <div className="text-center mb-10 sm:mb-14">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#0d1b2a] tracking-widest uppercase mb-3">Contact Us</h1>
        <p className="text-gray-500 text-sm sm:text-base max-w-xl mx-auto">
          Have a question about our products, an order, or anything else? Send us a message and we'll respond within 1–2 business days.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-12 items-start">

        {/* Left: contact info */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[#0d1b2a] rounded-xl p-6 text-white">
            <p className="font-bold tracking-widest text-sm uppercase mb-1">Forge Amino</p>
            <p className="text-[#4fc3f7] text-xs tracking-widest mb-5">Research Peptides</p>

            <div className="flex items-start gap-3 mb-5">
              <Mail size={16} className="text-[#4fc3f7] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Email</p>
                <a href="mailto:forgeamino@gmail.com" className="text-sm text-white hover:text-[#4fc3f7] transition-colors">
                  forgeamino@gmail.com
                </a>
              </div>
            </div>

            <div className="border-t border-white/10 pt-5">
              <p className="text-xs text-gray-400 leading-relaxed">
                We typically respond within <span className="text-white font-semibold">1–2 business days</span>. For order-related inquiries, please include your order details.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
            <p className="text-xs font-bold text-[#0d1b2a] uppercase tracking-wide mb-2">Research Use Only</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              All products sold by Forge Amino are strictly for research and development purposes. They are not intended for human consumption.
            </p>
          </div>
        </div>

        {/* Right: form */}
        <form onSubmit={handleSubmit} className="md:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 space-y-5">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-[#0d1b2a] uppercase tracking-wide mb-1.5" htmlFor="name">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={form.name}
                onChange={handleChange}
                placeholder="Your name"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-[#0d1b2a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2196f3]/40 focus:border-[#2196f3] transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#0d1b2a] uppercase tracking-wide mb-1.5" htmlFor="email">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-[#0d1b2a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2196f3]/40 focus:border-[#2196f3] transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0d1b2a] uppercase tracking-wide mb-1.5" htmlFor="subject">
              Subject
            </label>
            <input
              id="subject"
              name="subject"
              type="text"
              value={form.subject}
              onChange={handleChange}
              placeholder="What's this about?"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-[#0d1b2a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2196f3]/40 focus:border-[#2196f3] transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0d1b2a] uppercase tracking-wide mb-1.5" htmlFor="message">
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={6}
              value={form.message}
              onChange={handleChange}
              placeholder="Tell us how we can help..."
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-[#0d1b2a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2196f3]/40 focus:border-[#2196f3] transition resize-none"
            />
          </div>

          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-red-600">{errorMsg}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full flex items-center justify-center gap-2 bg-[#0d1b2a] text-white py-3.5 rounded-full font-bold tracking-widest uppercase text-sm hover:bg-[#1a2e45] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Sending...
              </>
            ) : (
              <>
                <Send size={15} />
                Send Message
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
