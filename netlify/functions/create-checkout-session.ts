import type { Handler } from '@netlify/functions'
import Stripe from 'stripe'
import { getAdminDb } from './lib/firebaseAdmin'
import { getDeliveryFee, getCardProcessingFee } from '../../src/config/business'

interface RequestItem {
  productId: string
  product: string
  quantity: number
}

interface ProductDoc {
  name: string
  nameEn?: string
  price: number
  available: boolean
  maxQuantity?: number
}

const PICKUP_ADDRESS = '149 Carshalton Dr, Lyman, SC 29365'

let stripeClient: Stripe | undefined
function getStripe() {
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  return stripeClient
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
    const { items, successUrl, cancelUrl, metadata } = JSON.parse(event.body || '{}') as {
      items?: RequestItem[]
      successUrl?: string
      cancelUrl?: string
      metadata?: Record<string, string>
    }

    if (!items?.length || !successUrl || !cancelUrl) {
      return { statusCode: 400, body: 'Missing required fields' }
    }

    // Only ever redirect back to whichever site is calling this function (prod, a
    // branch deploy, a deploy preview, or local dev) — never to an attacker-supplied domain.
    const requestOrigin = event.headers.origin || (event.headers.host ? `https://${event.headers.host}` : '')
    const isSameOrigin = (url: string) => {
      try {
        return !!requestOrigin && new URL(url).origin === new URL(requestOrigin).origin
      } catch {
        return false
      }
    }
    if (!isSameOrigin(successUrl) || !isSameOrigin(cancelUrl)) {
      return { statusCode: 400, body: 'Invalid redirect URL' }
    }

    const isEn = metadata?.language === 'en'
    const db = getAdminDb()

    if (items.some(i => !i.productId)) {
      return { statusCode: 400, body: 'All items must reference a catalog product' }
    }

    const productIds = [...new Set(items.map(i => i.productId))]
    const productDocs = await Promise.all(productIds.map(id => db.collection('products').doc(id).get()))
    const productsById = new Map(productDocs.filter(d => d.exists).map(d => [d.id, d.data() as ProductDoc]))

    let subtotal = 0
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []

    for (const item of items) {
      const requestedQuantity = Math.max(1, Math.floor(Number(item.quantity)) || 1)

      // Catalog product: price, availability and quantity cap come from Firestore,
      // never from the client, so a tampered request can't buy a real product for less.
      const product = productsById.get(item.productId)
      if (!product || !product.available) {
        return { statusCode: 400, body: 'Invalid or unavailable product' }
      }
      const quantity = product.maxQuantity != null ? Math.min(requestedQuantity, product.maxQuantity) : requestedQuantity
      const name = isEn && product.nameEn ? product.nameEn : product.name
      subtotal += product.price * quantity
      lineItems.push({
        quantity,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(product.price * 100),
          product_data: { name, metadata: { kind: 'product' } },
        },
      })
    }

    const deliveryMethod = metadata?.deliveryMethod === 'delivery' ? 'delivery' : 'pickup'
    const deliveryFee = getDeliveryFee(deliveryMethod)
    if (deliveryFee > 0) {
      subtotal += deliveryFee
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(deliveryFee * 100),
          product_data: { name: isEn ? 'Delivery' : 'Envío', metadata: { kind: 'shipping' } },
        },
      })
    }

    // Card network rules prohibit surcharging debit/prepaid cards, so this only
    // applies when the customer told us they're paying with credit.
    const processingFee = metadata?.applyProcessingFee === 'true' ? getCardProcessingFee(subtotal) : 0
    if (processingFee > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(processingFee * 100),
          product_data: { name: isEn ? 'Card processing fee' : 'Cargo por procesamiento de pago', metadata: { kind: 'fee' } },
        },
      })
    }

    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      locale: isEn ? 'en' : 'es',
      phone_number_collection: { enabled: true },
      // Only ask for a shipping address when the customer chose delivery; pickup orders don't need one.
      ...(deliveryMethod === 'delivery' ? { shipping_address_collection: { allowed_countries: ['US'] } } : {}),
      customer_creation: 'always',
      invoice_creation: {
        enabled: true,
        // For pickup orders there's no shipping address on the invoice, so show
        // where to pick it up instead.
        ...(deliveryMethod !== 'delivery' ? {
          invoice_data: {
            custom_fields: [{
              name: isEn ? 'Pickup address' : 'Dirección de retiro',
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
