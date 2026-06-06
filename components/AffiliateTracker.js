'use client'
import { useEffect } from 'react'

// Captures ?ref= URL param on any page and stores in sessionStorage.
// Checkout reads it back so the code persists even after navigation.
export default function AffiliateTracker() {
useEffect(() => {
const params = new URLSearchParams(window.location.search)
const ref = params.get('ref')
if (ref) {
sessionStorage.setItem('affiliateRef', ref.trim().toUpperCase())
}
}, [])
return null
}
