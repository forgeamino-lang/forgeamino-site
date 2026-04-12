import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'forgeamino@gmail.com'
const FROM_EMAIL = 'orders@forgeamino.us'

export async function POST(request) {
  try {
    const { name, email, subject, message } = await request.json()

    if (!name || !email || !message) {
      return Response.json({ error: 'Name, email, and message are required.' }, { status: 400 })
    }

    // Email to admin
    await resend.emails.send({
      from: FROM_EMAIL,
      reply_to: email,
      to: ADMIN_EMAIL,
      subject: `Contact Form: ${subject || 'New message from ' + name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f8f8; padding: 24px;">
          <div style="background: #0d1b2a; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #4fc3f7; font-size: 20px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">New Contact Message</h1>
            <p style="color: #ffffff80; font-size: 12px; margin: 6px 0 0;">Forge Amino — forgeamino.us</p>
          </div>
          <div style="background: #ffffff; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; width: 80px;">From</td>
                <td style="padding: 8px 0; font-size: 14px; color: #0d1b2a; font-weight: bold;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Email</td>
                <td style="padding: 8px 0; font-size: 14px; color: #2196f3;"><a href="mailto:${email}" style="color: #2196f3;">${email}</a></td>
              </tr>
              ${subject ? `<tr>
                <td style="padding: 8px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Subject</td>
                <td style="padding: 8px 0; font-size: 14px; color: #0d1b2a;">${subject}</td>
              </tr>` : ''}
            </table>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
            <p style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Message</p>
            <p style="font-size: 14px; color: #374151; line-height: 1.6; white-space: pre-wrap; margin: 0;">${message}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">Reply directly to this email to respond to ${name}.</p>
          </div>
        </div>
      `,
    })

    // Confirmation email to sender
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `We received your message — Forge Amino`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f8f8; padding: 24px;">
          <div style="background: #0d1b2a; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #4fc3f7; font-size: 20px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Message Received</h1>
            <p style="color: #ffffff80; font-size: 12px; margin: 6px 0 0;">Forge Amino Research Peptides</p>
          </div>
          <div style="background: #ffffff; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 14px; color: #374151; line-height: 1.6;">Hi ${name},</p>
            <p style="font-size: 14px; color: #374151; line-height: 1.6;">Thanks for reaching out. We've received your message and will get back to you within 1–2 business days.</p>
            <div style="background: #f8f9fa; border-left: 3px solid #2196f3; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0;">
              <p style="font-size: 12px; color: #6b7280; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 1px;">Your message</p>
              <p style="font-size: 13px; color: #374151; margin: 0; white-space: pre-wrap;">${message}</p>
            </div>
            <p style="font-size: 14px; color: #374151; line-height: 1.6;">— The Forge Amino Team</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
            <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">All products are for research purposes only and not intended for human consumption.</p>
          </div>
        </div>
      `,
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error('Contact form error:', err)
    return Response.json({ error: 'Failed to send message. Please try again.' }, { status: 500 })
  }
}
