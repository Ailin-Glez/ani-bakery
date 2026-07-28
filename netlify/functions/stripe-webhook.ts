import type { Handler } from '@netlify/functions'
import Stripe from 'stripe'
import { getAdminDb } from './lib/firebaseAdmin'

function formatAddress(address: Stripe.Address | null | undefined) {
  if (!address) return ''
  return [address.line1, address.line2, address.city, address.state, address.postal_code, address.country]
    .filter(Boolean)
    .join(', ')
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

  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: 'ignored' }
  }

  try {
    const session = stripeEvent.data.object as Stripe.Checkout.Session
    const db = getAdminDb()

    const existing = await db.collection('sales').where('orderId', '==', session.id).limit(1).get()
    if (!existing.empty) {
      return { statusCode: 200, body: 'already processed' }
    }

    const fullSession = await stripe.checkout.sessions.retrieve(session.id, { expand: ['line_items', 'line_items.data.price'] })
    const lineItems = fullSession.line_items?.data || []
    const customerDetails = fullSession.customer_details
    const shippingAddress = formatAddress(fullSession.shipping_details?.address)
    const metadata = fullSession.metadata || {}
    const now = new Date().toISOString()

    await Promise.all(lineItems.map(item => db.collection('sales').add({
      orderId: session.id,
      customerName: customerDetails?.name || fullSession.shipping_details?.name || '',
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
      status: 'in_progress',
      source: 'web',
      createdAt: now,
      paid: true,
      paymentMethod: 'stripe',
      paidAt: now,
      language: metadata.language === 'en' ? 'en' : 'es',
    })))

    return { statusCode: 200, body: 'ok' }
  } catch (err) {
    console.error('stripe-webhook error:', err)
    return { statusCode: 500, body: 'Internal error' }
  }
}
