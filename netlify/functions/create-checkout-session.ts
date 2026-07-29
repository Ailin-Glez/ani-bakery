import type { Handler } from '@netlify/functions'
import Stripe from 'stripe'

interface CartItem {
  product: string
  quantity: number
  unitPrice: number
  kind?: 'shipping' | 'fee'
}

const PICKUP_ADDRESS = '149 Carshalton Dr, Lyman, SC 29365'

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('create-checkout-session: missing STRIPE_SECRET_KEY')
    return { statusCode: 500, body: 'Payment service not configured' }
  }

  try {
    const { items, successUrl, cancelUrl, metadata } = JSON.parse(event.body || '{}') as {
      items?: CartItem[]
      successUrl?: string
      cancelUrl?: string
      metadata?: Record<string, string>
    }

    if (!items?.length || !successUrl || !cancelUrl) {
      return { statusCode: 400, body: 'Missing required fields' }
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: items.map(item => ({
        quantity: item.quantity,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(item.unitPrice * 100),
          product_data: { name: item.product, metadata: { kind: item.kind || 'product' } },
        },
      })),
      locale: metadata?.language === 'en' ? 'en' : 'es',
      phone_number_collection: { enabled: true },
      // Only ask for a shipping address when the customer chose delivery; pickup orders don't need one.
      ...(metadata?.deliveryMethod === 'delivery' ? { shipping_address_collection: { allowed_countries: ['US'] } } : {}),
      customer_creation: 'always',
      invoice_creation: {
        enabled: true,
        // For pickup orders there's no shipping address on the invoice, so show
        // where to pick it up instead.
        ...(metadata?.deliveryMethod !== 'delivery' ? {
          invoice_data: {
            custom_fields: [{
              name: metadata?.language === 'en' ? 'Pickup address' : 'Dirección de retiro',
              value: PICKUP_ADDRESS,
            }],
          },
        } : {}),
      },
      metadata,
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) }
  } catch (err) {
    console.error('create-checkout-session error:', err)
    return { statusCode: 500, body: JSON.stringify({ success: false }) }
  }
}
