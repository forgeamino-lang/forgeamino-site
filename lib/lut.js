// Lut Turbo (ACH "Pay by Bank") integration helpers.
//
// create-session and cart-status are exposed as client-facing API routes
// (app/api/lut/*) since they never touch a dollar amount -- they only
// capture/read bank-account tokenization state.
//
// The actual money-moving call (transaction) is NOT exposed to the client.
// It is called server-side from app/api/orders/route.js using the
// server-computed, trusted order total -- mirroring how the rest of the
// order pipeline never trusts a client-supplied dollar amount.

const LUT_BASE_URL = process.env.LUT_BASE_URL || 'https://turbo-myportal.demo.mylut.com/backend'
const LUT_API_KEY = process.env.LUT_API_KEY

// Submits the ACH debit for a captured payToken. Returns
// { ok: true, transactionId } on success, or { ok: false, error, lutResponseCode }.
export async function chargeLutTransaction({ merchantId, amount, cartId, payToken }) {
  if (!LUT_API_KEY) {
    return { ok: false, error: 'Lut Turbo is not configured (missing LUT_API_KEY)' }
  }
  if (!merchantId || !cartId || !payToken || !(Number(amount) > 0)) {
    return { ok: false, error: 'Missing required Lut transaction fields' }
  }

  try {
    const resp = await fetch(`${LUT_BASE_URL}/transaction`, {
      method: 'POST',
      headers: {
        'API-KEY': LUT_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchantId,
        amount: Number(amount),
        paymentMethod: 'eonline',
        cartId,
        payToken,
      }),
    })
    const json = await resp.json()

    if (json.response !== 1) {
      return {
        ok: false,
        error: json.responseText || 'Lut Turbo transaction was rejected',
        lutResponseCode: json.responseCode,
      }
    }

    return { ok: true, transactionId: json.responseObject }
  } catch (e) {
    return { ok: false, error: e?.message || 'Lut Turbo transaction request failed' }
  }
}
