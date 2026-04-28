import { exchangeCodeForTokens } from '../../../../../lib/quickbooks'
import { createServerClient } from '../../../../../lib/supabase'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const error = searchParams.get('error')

  if (error) {
    return new Response(`<html><body><h2>❌ Authorization failed: ${error}</h2></body></html>`, {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  if (!code || !realmId) {
    return new Response(`<html><body><h2>❌ Missing code or realmId</h2></body></html>`, {
      headers: { 'Content-Type': 'text/html' },
    })
  }

try {
    const tokens = await exchangeCodeForTokens(code)

    // Persist the new refresh token to Supabase so the running site
    // immediately picks it up on the next QBO call. (No redeploy needed.)
    try {
      const supabase = createServerClient()
      await supabase
        .from('secrets')
        .upsert(
          { key: 'qbo_refresh_token', value: tokens.refresh_token, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
    } catch (persistErr) {
      console.error('OAuth callback: Supabase write failed:', persistErr.message)
    }

    return new Response(
      `<!DOCTYPE html>
<html>
<head><title>QuickBooks Connected</title></head>
<body style="font-family:system-ui,sans-serif;padding:40px;max-width:700px;margin:0 auto">
  <h2 style="color:#1a7c3e">✅ QuickBooks Authorization Successful!</h2>
  <p>Add these two values to your <strong>Vercel Environment Variables</strong>, then redeploy:</p>
  <table style="border-collapse:collapse;width:100%;margin:20px 0">
    <tr style="background:#f5f5f5">
      <td style="padding:12px;border:1px solid #ddd;font-weight:bold;white-space:nowrap">QBO_REALM_ID</td>
      <td style="padding:12px;border:1px solid #ddd;font-family:monospace;word-break:break-all">${realmId}</td>
    </tr>
    <tr>
      <td style="padding:12px;border:1px solid #ddd;font-weight:bold;white-space:nowrap">QBO_REFRESH_TOKEN</td>
      <td style="padding:12px;border:1px solid #ddd;font-family:monospace;word-break:break-all">${tokens.refresh_token}</td>
    </tr>
  </table>
  <p style="color:#666;font-size:14px">After saving both values in Vercel and redeploying, every new order on forgeamino.us will automatically create a customer profile and sales receipt in QuickBooks.</p>
  <p style="color:#999;font-size:12px">⚠️ Keep these values secret — treat them like passwords.</p>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  } catch (err) {
    return new Response(
      `<html><body><h2>❌ Error: ${err.message}</h2></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }
}
