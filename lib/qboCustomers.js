// QuickBooks customers → public.qbo_customers (daily sync).
// Lets the first-order discount recognise people who bought before the
// website existed, or were invoiced by hand in QuickBooks.

// QBO email fields sometimes hold several addresses ("a@x.com, b@y.com").
// Keep the first valid one.
export function firstEmail(raw) {
  const parts = String(raw || '').split(/[,;\s]+/).map(s => s.trim()).filter(s => /.+@.+\..+/.test(s))
  return parts[0] || null
}

// Map one QBO Customer object to a qbo_customers row.
export function mapQboCustomer(c) {
  if (!c || !c.Id) return null
  const bill = c.BillAddr || {}
  const ship = c.ShipAddr || {}
  const street = a => [a.Line1, a.Line2].filter(Boolean).join(' ').trim() || null
  return {
    qbo_id: String(c.Id),
    display_name: c.DisplayName || null,
    email: firstEmail(c.PrimaryEmailAddr?.Address),
    phone: c.PrimaryPhone?.FreeFormNumber || null,
    mobile: c.Mobile?.FreeFormNumber || null,
    bill_street: street(bill),
    bill_zip: bill.PostalCode || null,
    ship_street: street(ship),
    ship_zip: ship.PostalCode || null,
    active: c.Active !== false,
    qbo_created_at: c.MetaData?.CreateTime || null,
  }
}
