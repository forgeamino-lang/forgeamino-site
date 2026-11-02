import { describe, test, expect } from 'vitest'
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test'
process.env.RESEND_API_KEY ||= 're_test'
const { formatDob, buildCustomerMemo } = await import('../lib/quickbooks.js')

describe('QBO invoice memo', () => {
  test('formats DOB without timezone shift', () => {
    expect(formatDob('1984-01-05')).toBe('01/05/1984')
    expect(formatDob('')).toBe('')
    expect(formatDob(null)).toBe('')
    expect(formatDob('garbage')).toBe('')
  })
  test('compounded order memo prints DOB', () => {
    expect(buildCustomerMemo({ order_number: 'FA-1', customer_email: 'a@b.com', customer_dob: '1990-12-31' }))
      .toBe('Forge Amino Order #FA-1 | Email: a@b.com | COMPOUNDED PHARMACY ORDER | DOB: 12/31/1990')
  })
  test('regular order memo unchanged', () => {
    expect(buildCustomerMemo({ order_number: 'FA-2', customer_email: 'a@b.com' }))
      .toBe('Forge Amino Order #FA-2 | Email: a@b.com')
  })
})
