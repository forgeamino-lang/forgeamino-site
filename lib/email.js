import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const VENMO_HANDLE = '@ForgeA'
const VENMO_NOTE_REQUIRED = 'Thank you'
const ADMIN_EMAIL = [process.env.ADMIN_EMAIL || 'forgeamino@gmail.com', 'abethmoses@gmail.com']
const FROM_EMAIL = 'orders@forgeamino.us'
const REPLY_TO = 'forgeamino@gmail.com'

// Format line items for email display
function formatLineItems(items) {
    return items.map(item =>
          `<tr>
                <td style="padding:8px 0;border-bottom:1px solid #eee;">${item.name}</td>
                      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;">x${item.quantity}</td>
                            <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">$${(item.price * item.quantity).toFixed(2)}</td>
                                </tr>`
                       ).join('')
}

// Base email wrapper
function emailWrapper(content) {
    return `
      <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
                      <tr><td align="center">
                              <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
                                        <!-- Header -->
                                                  <tr>
                                                              <td style="background:#0d1b2a;padding:24px 32px;">
                                                                            <p style="margin:0;color:#fff;font-size:22px;font-weight:bold;letter-spacing:2px;">FORGE AMINO</p>
                                                                                          <p style="margin:4px 0 0;color:#4fc3f7;font-size:12px;letter-spacing:1px;">RESEARCH PEPTIDES</p>
                                                                                                      </td>
                                                                                                                </tr>
                                                                                                                          <!-- Body -->
                                                                                                                                    <tr><td style="padding:32px;">${content}</td></tr>
                                                                                                                                              <!-- Footer -->
                                                                                                                                                        <tr>
                                                                                                                                                                    <td style="background:#f9f9f9;padding:20px 32px;border-top:1px solid #eee;">
                                                                                                                                                                                  <p style="margin:0;font-size:12px;color:#999;text-align:center;">
                                                                                                                                                                                                  Forge Amino | forgeamino.us<br>
                                                                                                                                                                                                                  For research purposes only. Not for human consumption.
                                                                                                                                                                                                                                </p>
                                                                                                                                                                                                                                            </td>
                                                                                                                                                                                                                                                      </tr>
                                                                                                                                                                                                                                                              </table>
                                                                                                                                                                                                                                                                    </td></tr>
                                                                                                                                                                                                                                                                        </table>
                                                                                                                                                                                                                                                                          </body>
                                                                                                                                                                                                                                                                            </html>`
}

// EMAIL 1: Order received — sent immediately to customer
export async function sendOrderConfirmationEmail(order) {
    const paymentInstructions = getPaymentInstructions(order.payment_method, order.total)
    const html = emailWrapper(`
        <h2 style="color:#0d1b2a;margin:0 0 8px;">Order Received!</h2>
            <p style="color:#555;margin:0 0 24px;">Thanks ${order.customer_name.split(' ')[0]}, we've received your order. Complete your payment using the instructions below and we'll get it processed.</p>

                <!-- Order number -->
                    <div style="background:#f0f7ff;border:2px solid #2196f3;border-radius:6px;padding:16px;margin-bottom:24px;text-align:center;">
                          <p style="margin:0;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px;">Your Order Number</p>
                                <p style="margin:4px 0 0;font-size:28px;font-weight:bold;color:#0d1b2a;">${order.order_number}</p>
                                    </div>

                                        <!-- Payment instructions -->
                                            <div style="background:#fff3cd;border:2px solid #ffc107;border-radius:6px;padding:20px;margin-bottom:24px;">
                                                  <h3 style="margin:0 0 12px;color:#0d1b2a;font-size:16px;">&#9888;&#xFE0F; Payment Instructions — Read Carefully</h3>
                                                        ${paymentInstructions}
                                                              <div style="background:#dc3545;border-radius:4px;padding:12px;margin-top:16px;">
                                                                      <p style="margin:0;color:#fff;font-size:13px;font-weight:bold;text-align:center;">
                                                                                &#9940; You MUST write exactly "<strong>${VENMO_NOTE_REQUIRED}</strong>" in the comment/note field.<br>
                                                                                          Any other note will result in your payment being returned and your order cannot be processed.
                                                                                                  </p>
                                                                                                        </div>
                                                                                                            </div>
                                                                                                            
                                                                                                                <!-- Order summary -->
                                                                                                                    <h3 style="color:#0d1b2a;margin:0 0 12px;">Order Summary</h3>
                                                                                                                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                                                                                                                              <tr style="background:#f9f9f9;">
                                                                                                                                      <th style="padding:8px;text-align:left;font-size:12px;text-transform:uppercase;color:#666;">Item</th>
                                                                                                                                              <th style="padding:8px;text-align:center;font-size:12px;text-transform:uppercase;color:#666;">Qty</th>
                                                                                                                                                      <th style="padding:8px;text-align:right;font-size:12px;text-transform:uppercase;color:#666;">Price</th>
                                                                                                                                                            </tr>
                                                                                                                                                                  ${formatLineItems(order.line_items)}
                                                                                                                                                                        ${order.tax_amount > 0 ? `
                                                                                                                                                                              <tr>
                                                                                                                                                                                      <td colspan="2" style="padding:10px 8px 0;color:#555;font-size:14px;">Subtotal</td>
                                                                                                                                                                                              <td style="padding:10px 8px 0;text-align:right;color:#555;font-size:14px;">$${(order.subtotal ?? order.total).toFixed(2)}</td>
                                                                                                                                                                                                    </tr>
                                                                                                                                                                                                          <tr>
                                                                                                                                                                                                                  <td colspan="2" style="padding:4px 8px;color:#555;font-size:14px;">
                                                                                                                                                                                                                            Tax (${order.shipping_address.city ? order.shipping_address.city + ', ' : ''}${order.shipping_address.state} — ${((order.tax_rate ?? 0) * 100).toFixed(2).replace(/\.00$/, '')}% combined)
                                                                                                                                                                                                                                    </td>
                                                                                                                                                                                                                                            <td style="padding:4px 8px;text-align:right;color:#555;font-size:14px;">$${order.tax_amount.toFixed(2)}</td>
                                                                                                                                                                                                                                                  </tr>` : ''}
                                                                                                                                                                                                                                                        <tr>
                                                                                                                                                                                                                                                                <td colspan="2" style="padding:12px 8px 0;font-weight:bold;border-top:2px solid #eee;">Total</td>
                                                                                                                                                                                                                                                                        <td style="padding:12px 8px 0;text-align:right;font-weight:bold;font-size:18px;border-top:2px solid #eee;">$${order.total.toFixed(2)}</td>
                                                                                                                                                                                                                                                                              </tr>
                                                                                                                                                                                                                                                                                  </table>
                                                                                                                                                                                                                                                                                  
                                                                                                                                                                                                                                                                                      <!-- Shipping address -->
                                                                                                                                                                                                                                                                                          <h3 style="color:#0d1b2a;margin:24px 0 8px;">Shipping Address</h3>
                                                                                                                                                                                                                                                                                              <p style="margin:0;color:#555;line-height:1.6;">
                                                                                                                                                                                                                                                                                                    ${order.customer_name}<br>
                                                                                                                                                                                                                                                                                                          ${order.shipping_address.street}<br>
                                                                                                                                                                                                                                                                                                                ${order.shipping_address.city}, ${order.shipping_address.state} ${order.shipping_address.zip}
                                                                                                                                                                                                                                                                                                                    </p>
                                                                                                                                                                                                                                                                                                                        <p style="margin:24px 0 0;color:#888;font-size:13px;">Once we confirm your payment, we'll send you a shipping update. Questions? Reply to this email.</p>
                                                                                                                                                                                                                                                                                                                          `)
    return resend.emails.send({
          from: FROM_EMAIL,
          reply_to: REPLY_TO,
          to: order.customer_email,
          subject: `Order ${order.order_number} Received — Payment Instructions Inside`,
          html,
    })
}

// EMAIL 2: Payment confirmed — sent when admin marks order as paid
export async function sendPaymentConfirmedEmail(order) {
    const html = emailWrapper(`
        <h2 style="color:#0d1b2a;margin:0 0 8px;">Payment Confirmed &#10003;</h2>
            <p style="color:#555;margin:0 0 24px;">Great news — we've received your payment for order <strong>${order.order_number}</strong>. Your order is now being prepared for shipment.</p>
                <div style="background:#d4edda;border:2px solid #28a745;border-radius:6px;padding:16px;margin-bottom:24px;text-align:center;">
                      <p style="margin:0;font-size:14px;color:#155724;font-weight:bold;">&#10003; Payment Received — Order Processing</p>
                          </div>
                              <h3 style="color:#0d1b2a;margin:0 0 12px;">Order Summary</h3>
                                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                                        <tr style="background:#f9f9f9;">
                                                <th style="padding:8px;text-align:left;font-size:12px;color:#666;">Item</th>
                                                        <th style="padding:8px;text-align:center;font-size:12px;color:#666;">Qty</th>
                                                                <th style="padding:8px;text-align:right;font-size:12px;color:#666;">Price</th>
                                                                      </tr>
                                                                            ${formatLineItems(order.line_items)}
                                                                                </table>
                                                                                    <p style="color:#555;font-size:14px;">We'll send you another email with your tracking number as soon as your order ships. Typical processing time is 1-2 business days.</p>
                                                                                      `)
    return resend.emails.send({
          from: FROM_EMAIL,
          reply_to: REPLY_TO,
          to: order.customer_email,
          subject: `Order ${order.order_number} — Payment Confirmed`,
          html,
    })
}

// EMAIL 3: Shipped — sent when admin enters tracking and marks shipped
export async function sendShippedEmail(order) {
    const html = emailWrapper(`
        <h2 style="color:#0d1b2a;margin:0 0 8px;">Your Order Has Shipped! &#128666;</h2>
            <p style="color:#555;margin:0 0 24px;">Order <strong>${order.order_number}</strong> is on its way!</p>
                ${order.tracking_number ? `
                    <div style="background:#f0f7ff;border:2px solid #2196f3;border-radius:6px;padding:20px;margin-bottom:24px;text-align:center;">
                          <p style="margin:0;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px;">Tracking Number</p>
                                <p style="margin:8px 0;font-size:22px;font-weight:bold;color:#0d1b2a;">${order.tracking_number}</p>
                                      <p style="margin:0;font-size:13px;color:#2196f3;">Track your package with the carrier using the number above</p>
                                          </div>` : ''}
                                              <p style="color:#555;font-size:14px;">Shipping Address:<br>
                                                    <strong>${order.customer_name}</strong><br>
                                                          ${order.shipping_address.street}<br>
                                                                ${order.shipping_address.city}, ${order.shipping_address.state} ${order.shipping_address.zip}
                                                                    </p>
                                                                        <p style="color:#888;font-size:13px;margin-top:24px;">Thank you for your order. For research purposes only.</p>
                                                                          `)
    return resend.emails.send({
          from: FROM_EMAIL,
          reply_to: REPLY_TO,
          to: order.customer_email,
          subject: `Order ${order.order_number} Shipped!`,
          html,
    })
}

// EMAIL 4: Admin new order alert
export async function sendAdminOrderAlert(order, invoice, pdfBase64) {
  const docNumber = invoice?.DocNumber || order.order_number
  const total = invoice?.TotalAmt ?? order.total
  const invoiceLink = invoice?.InvoiceLink
  const customerName = order.customer_name || 'Customer'
  const customerEmail = order.customer_email || ''
  const html = emailWrapper(`
    <h2 style="color:#0d1b2a;margin:0 0 12px;">Forge Amino Invoice ${docNumber}</h2>
    <p>Order <strong>${order.order_number}</strong> from <strong>${customerName}</strong> has been invoiced in QuickBooks.</p>
    <p><strong>QBO Invoice:</strong> ${docNumber}</p>
    <p><strong>Customer:</strong> ${customerName}${customerEmail ? ` (${customerEmail})` : ''}</p>
    <p><strong>Total:</strong> $${Number(total).toFixed(2)}</p>
    <p style="margin-top:16px;">The official QuickBooks invoice is attached as a PDF.</p>
    ${invoiceLink ? `<p style="margin-top:24px;"><a href="${invoiceLink}" style="background:#0d1b2a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">View Invoice in QuickBooks</a></p>` : ''}
  `)
  const payload = {
    from: FROM_EMAIL,
    reply_to: REPLY_TO,
    to: 'abethmoses@gmail.com',
    cc: [process.env.ADMIN_EMAIL || 'forgeamino@gmail.com'],
    subject: `Forge Amino Invoice ${docNumber} — ${customerName} — $${Number(total).toFixed(2)}`,
    html,
  }
  if (pdfBase64) {
    payload.attachments = [{ filename: `Invoice-${docNumber}.pdf`, content: pdfBase64 }]
  }
  return resend.emails.send(payload)
}

function getPaymentInstructions(method, total) {
    if (method === 'venmo') {
          return `
                <p style="margin:0 0 12px;font-size:15px;color:#333;"><strong>Send via Venmo:</strong></p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                        <td style="padding:8px 0;"><strong>Venmo Handle:</strong></td>
                                                  <td style="padding:8px 0;font-size:20px;font-weight:bold;color:#0d1b2a;">${VENMO_HANDLE}</td>
                                                          </tr>
                                                                  <tr>
                                                                            <td style="padding:8px 0;"><strong>Amount:</strong></td>
                                                                                      <td style="padding:8px 0;font-size:20px;font-weight:bold;color:#0d1b2a;">$${total.toFixed(2)}</td>
                                                                                              </tr>
                                                                                                      <tr>
                                                                                                                <td style="padding:8px 0;"><strong>Comment/Note:</strong></td>
                                                                                                                          <td style="padding:8px 0;font-size:20px;font-weight:bold;color:#dc3545;">"${VENMO_NOTE_REQUIRED}"</td>
                                                                                                                                  </tr>
                                                                                                                                        </table>
                                                                                                                                              <p style="margin:12px 0 0;padding:10px 12px;background:#e8f4fd;border-left:3px solid #2196f3;font-size:13px;color:#333;line-height:1.5;">
                                                                                                                                                      <strong>First time paying us on Venmo?</strong> If this is your first time paying @ForgeA via Venmo you will likely be asked for the last four digits of the associated phone number which are <strong>1963</strong>.
                                                                                                                                                            </p>
                                                                                                                                                                `
    }
    // Additional payment methods can be added here (Zelle, bank transfer)
  return `<p>Payment instructions for ${method}.</p>`
}
