import { describe, test, expect } from 'vitest'
import { mapQboCustomer, firstEmail } from '../lib/qboCustomers.js'

describe('QuickBooks customer mapping', () => {
  test('maps email, phones and both addresses', () => {
    const row = mapQboCustomer({
      Id: '42', DisplayName: 'Jane Doe', Active: false,
      PrimaryEmailAddr: { Address: 'Jane@X.com, other@y.com' },
      PrimaryPhone: { FreeFormNumber: '(405) 555-1212' }, Mobile: { FreeFormNumber: '405-555-9999' },
      BillAddr: { Line1: '12 Oak Lane', Line2: 'Apt 3', PostalCode: '73069' },
      ShipAddr: { Line1: '9 Elm St', PostalCode: '73072-1234' },
      MetaData: { CreateTime: '2025-11-02T10:00:00-07:00' },
    })
    expect(row).toMatchObject({
      qbo_id: '42', email: 'Jane@X.com', phone: '(405) 555-1212', mobile: '405-555-9999',
      bill_street: '12 Oak Lane Apt 3', bill_zip: '73069', ship_street: '9 Elm St', ship_zip: '73072-1234', active: false,
    })
  })
  test('missing fields become null; no Id → skipped', () => {
    expect(mapQboCustomer({ Id: 1 })).toMatchObject({ email: null, phone: null, bill_street: null, active: true })
    expect(mapQboCustomer({})).toBeNull()
  })
  test('firstEmail ignores junk', () => {
    expect(firstEmail('n/a; real@x.com')).toBe('real@x.com')
    expect(firstEmail('')).toBeNull()
  })
})
