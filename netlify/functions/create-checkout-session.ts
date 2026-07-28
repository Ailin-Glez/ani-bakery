import type { Handler } from '@netlify/functions'
import Stripe from 'stripe'

interface CartItem {
  product: string
  quantity: number
  unitPrice: number
}

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('create-checkout-session: missing STRIPE_SECRET_KEY')
    return { statusCode: 500, body: 'Payment service not configured' }
  }

  try {
    const { items, successUrl, cancelUrl } = JSON.parse(event.body || '{}') as {
      items?: CartItem[]
      successUrl?: string
      cancelUrl?: string
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
          product_data: { name: item.product },
        },
      })),
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) }
  } catch (err) {
    console.error('create-checkout-session error:', err)
    return { statusCode: 500, body: JSON.stringify({ success: false }) }
  }
}
