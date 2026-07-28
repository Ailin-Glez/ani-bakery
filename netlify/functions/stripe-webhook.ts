import type { Handler } from '@netlify/functions'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { getAdminDb } from './lib/firebaseAdmin'
import { renderBrandedEmail, textToHtmlParagraphs } from './lib/emailTemplate'

const FROM_EMAIL = 'Ani\'s Artisan Bakery <pedidos@anisartisanbakery.com>'

async function emailInvoiceLink(invoice: Stripe.Invoice, email: string | null | undefined, isEn: boolean) {
  if (!email || !invoice.hosted_invoice_url || !process.env.RESEND_API_KEY) return

  const heading = isEn ? 'Here\'s your receipt' : 'Aquí está tu factura'
  const bodyText = isEn
    ? `Thank you for your order! You can view or download your invoice using the button below.`
    : `¡Gracias por tu pedido! Podés ver o descargar tu factura con el botón de abajo.`
  const html = renderBrandedEmail({
    heading,
    bodyHtml: textToHtmlParagraphs(bodyText),
    ctaLabel: isEn ? 'View invoice' : 'Ver factura',
    ctaUrl: invoice.hosted_invoice_url,
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: isEn ? 'Your receipt - Ani\'s Artisan Bakery' : 'Tu factura - Ani\'s Artisan Bakery',
    html,
  })
}

function formatAddress(address: Stripe.Address | null | undefined) {
  if (!address) return ''
  return [address.line1, address.line2, address.city, address.state, address.postal_code, address.country]
    .filter(Boolean)
    .join(', ')
}

async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  const db = getAdminDb()

  const existing = await db.collection('sales').where('orderId', '==', session.id).limit(1).get()
  if (!existing.empty) return

  const fullSession = await stripe.checkout.sessions.retrieve(session.id, { expand: ['line_items', 'line_items.data.price'] })
  const lineItems = fullSession.line_items?.data || []
  const customerDetails = fullSession.customer_details
  // As of newer Stripe API versions, shipping info moved from the (now-removed)
  // top-level `shipping_details` field to `collected_information.shipping_details`.
  const shippingDetails = fullSession.collected_information?.shipping_details
  const shippingAddress = formatAddress(shippingDetails?.address)
  const metadata = fullSession.metadata || {}
  const now = new Date().toISOString()
  const paymentIntentId = typeof fullSession.payment_intent === 'string' ? fullSession.payment_intent : fullSession.payment_intent?.id

  await Promise.all(lineItems.map(item => db.collection('sales').add({
    orderId: session.id,
    stripePaymentIntentId: paymentIntentId || '',
    customerName: customerDetails?.name || shippingDetails?.name || '',
    phone: customerDetails?.phone || '',
    email: customerDetails?.email || '',
    contactMethod: 'stripe',
    productName: item.description || '',
    quantity: item.quantity || 1,
    unitPrice: (item.price?.unit_amount ?? 0) / 100,
    total: (item.amount_total ?? 0) / 100,
    date: metadata.date || '',
    notes: metadata.notes || '',
    shippingAddress,
    deliveryMethod: metadata.deliveryMethod === 'delivery' ? 'delivery' : 'pickup',
    status: 'in_progress',
    source: 'web',
    createdAt: now,
    paid: true,
    paymentMethod: 'stripe',
    paidAt: now,
    language: metadata.language === 'en' ? 'en' : 'es',
  })))

  const invoiceId = typeof fullSession.invoice === 'string' ? fullSession.invoice : fullSession.invoice?.id
  if (invoiceId) {
    try {
      const invoice = await stripe.invoices.retrieve(invoiceId)
      await emailInvoiceLink(invoice, customerDetails?.email, metadata.language === 'en')
    } catch (err) {
      console.error('stripe-webhook: failed to email invoice:', err)
    }
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  if (!charge.refunded) return
  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  if (!paymentIntentId) return

  const db = getAdminDb()
  const matches = await db.collection('sales').where('stripePaymentIntentId', '==', paymentIntentId).get()
  if (matches.empty) return

  await Promise.all(matches.docs.map(doc => doc.ref.update({ status: 'cancelled', total: 0, unitPrice: 0 })))
}

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('stripe-webhook: missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET')
    return { statusCode: 500, body: 'Webhook not configured' }
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const signature = event.headers['stripe-signature']
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || ''

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature || '', process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('stripe-webhook: signature verification failed:', err)
    return { statusCode: 400, body: 'Invalid signature' }
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(stripe, stripeEvent.data.object as Stripe.Checkout.Session)
    } else if (stripeEvent.type === 'charge.refunded') {
      await handleChargeRefunded(stripeEvent.data.object as Stripe.Charge)
    }
    return { statusCode: 200, body: 'ok' }
  } catch (err) {
    console.error('stripe-webhook error:', err)
    return { statusCode: 500, body: 'Internal error' }
  }
}
