import type { Handler } from '@netlify/functions'
import { Resend } from 'resend'
import { renderBrandedEmail } from './lib/emailTemplate'

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'ailinglez89@gmail.com'
const FROM_EMAIL = 'Ani\'s Artisan Bakery <onboarding@resend.dev>'
const ADMIN_URL = 'https://anisartisanbakery.com/admin'

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('notify-review: missing RESEND_API_KEY')
    return { statusCode: 500, body: 'Email service not configured' }
  }

  try {
    const { name, comment, rating } = JSON.parse(event.body || '{}') as {
      name?: string
      comment?: string
      rating?: number
    }

    if (!name || !comment || !rating) {
      return { statusCode: 400, body: 'Missing required fields' }
    }

    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating)
    const resend = new Resend(process.env.RESEND_API_KEY)

    const html = renderBrandedEmail({
      heading: 'Nueva reseña pendiente de aprobación',
      bodyHtml: `
        <p style="margin:0 0 8px;"><strong>Nombre:</strong> ${name}</p>
        <p style="margin:0 0 8px;"><strong>Calificación:</strong> ${stars}</p>
        <p style="margin:0 0 8px;"><strong>Comentario:</strong> ${comment}</p>
      `,
      ctaLabel: 'Entrar al panel para aprobar o rechazar →',
      ctaUrl: ADMIN_URL,
    })

    await resend.emails.send({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject: `Nueva reseña de ${name} (${stars})`,
      html,
    })

    return { statusCode: 200, body: 'OK' }
  } catch (err) {
    console.error('notify-review error:', err)
    return { statusCode: 500, body: 'Error sending notification' }
  }
}
