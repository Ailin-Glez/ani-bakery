import type { Handler } from '@netlify/functions'
import { Resend } from 'resend'
import { renderBrandedEmail, textToHtmlParagraphs } from './lib/emailTemplate'

const TO_EMAIL = process.env.NOTIFY_EMAIL || 'ailinglez89@gmail.com'
const FROM_EMAIL = 'Ani\'s Artisan Bakery <onboarding@resend.dev>'

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('send-order-email: missing RESEND_API_KEY')
    return { statusCode: 500, body: 'Email service not configured' }
  }

  try {
    const { subject, message, replyTo, fromName, to } = JSON.parse(event.body || '{}') as {
      subject?: string
      message?: string
      replyTo?: string
      fromName?: string
      to?: string
    }

    if (!subject || !message) {
      return { statusCode: 400, body: 'Missing required fields' }
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const html = renderBrandedEmail({ heading: subject, bodyHtml: textToHtmlParagraphs(message) })

    await resend.emails.send({
      from: FROM_EMAIL,
      to: to || TO_EMAIL,
      subject,
      html,
      ...(replyTo ? { replyTo: fromName ? `${fromName} <${replyTo}>` : replyTo } : {}),
    })

    return { statusCode: 200, body: JSON.stringify({ success: true }) }
  } catch (err) {
    console.error('send-order-email error:', err)
    return { statusCode: 500, body: JSON.stringify({ success: false }) }
  }
}
