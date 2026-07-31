import type { Handler } from '@netlify/functions'
import Stripe from 'stripe'
import { getAdminDb } from './lib/firebaseAdmin'
import { getDeliveryFee, getTax, isOrderDateValid, BREAD_CATEGORY, MAX_BREAD_PER_ORDER, MAX_BREAD_PER_DAY, COOKIE_CATEGORY, MAX_COOKIES_PER_DAY } from '../../src/config/business'

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
  category?: string
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

    const date = metadata?.date || ''

    const productIds = [...new Set(items.map(i => i.productId))]
    const productDocs = await Promise.all(productIds.map(id => db.collection('products').doc(id).get()))
    const productsById = new Map(productDocs.filter(d => d.exists).map(d => [d.id, d.data() as ProductDoc]))

    // Cookies (alone or mixed with bread) need more lead time than a bread-only order.
    const hasCookies = items.some(item => productsById.get(item.productId)?.category === COOKIE_CATEGORY)
    if (!isOrderDateValid(date, hasCookies)) {
      return { statusCode: 400, body: 'Invalid order date' }
    }

    let subtotal = 0
    let requestedBreadQuantity = 0
    let requestedCookieQuantity = 0
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
      if (product.category === BREAD_CATEGORY) requestedBreadQuantity += quantity
      if (product.category === COOKIE_CATEGORY) requestedCookieQuantity += quantity
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

    if (requestedBreadQuantity > MAX_BREAD_PER_ORDER) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'ORDER_BREAD_LIMIT_EXCEEDED' }) }
    }

    // Shared helper: sums how much of a category was already sold for this date
    // (excluding cancelled sales), matching by product name since sales don't store a category.
    const getAlreadySoldForCategory = async (category: string) => {
      const categoryProductsSnap = await db.collection('products').where('category', '==', category).get()
      const categoryNames = new Set<string>()
      categoryProductsSnap.docs.forEach(d => {
        const p = d.data() as ProductDoc
        categoryNames.add(p.name)
        if (p.nameEn) categoryNames.add(p.nameEn)
      })

      const salesForDateSnap = await db.collection('sales').where('date', '==', date).get()
      return salesForDateSnap.docs.reduce((sum, d) => {
        const sale = d.data() as { productName: string; quantity: number; status: string }
        if (sale.status === 'cancelled' || !categoryNames.has(sale.productName)) return sum
        return sum + (sale.quantity || 0)
      }, 0)
    }

    if (requestedBreadQuantity > 0) {
      const alreadySoldBread = await getAlreadySoldForCategory(BREAD_CATEGORY)
      if (alreadySoldBread + requestedBreadQuantity > MAX_BREAD_PER_DAY) {
        const remaining = Math.max(0, MAX_BREAD_PER_DAY - alreadySoldBread)
        return { statusCode: 400, body: JSON.stringify({ success: false, error: 'DAILY_BREAD_LIMIT_EXCEEDED', remaining }) }
      }
    }

    if (requestedCookieQuantity > 0) {
      const alreadySoldCookies = await getAlreadySoldForCategory(COOKIE_CATEGORY)
      if (alreadySoldCookies + requestedCookieQuantity > MAX_COOKIES_PER_DAY) {
        const remaining = Math.max(0, MAX_COOKIES_PER_DAY - alreadySoldCookies)
        return { statusCode: 400, body: JSON.stringify({ success: false, error: 'DAILY_COOKIE_LIMIT_EXCEEDED', remaining }) }
      }
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

    const tax = getTax(subtotal)
    if (tax > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(tax * 100),
          product_data: { name: isEn ? 'Tax' : 'Impuestos', metadata: { kind: 'fee' } },
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
