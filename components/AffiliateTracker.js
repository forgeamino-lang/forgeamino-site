'use client'
import { useEffect } from 'react'

// Captures ?ref= (and ?credit=) URL params on any page and stores in sessionStorage.
// Checkout reads it back so the code persists even after navigation.
export default function AffiliateTracker() {
useEffect(() => {
const params = new URLSearchParams(window.location.search)
const ref = params.get('ref')
if (ref) {
sessionStorage.setItem('affiliateRef', ref.trim().toUpperCase())
}
// Store credit code from a win-back email link (?credit=BACK67-T6DVR)
const credit = params.get('credit')
if (credit) {
sessionStorage.setItem('storeCredit', credit.trim().toUpperCase())
}
// Sale code from an email or social link (?promo=HALLOWEEN25)
const promo = params.get('promo')
if (promo) {
sessionStorage.setItem('promoCode', promo.trim().toUpperCase())
}
}, [])
return null
}
