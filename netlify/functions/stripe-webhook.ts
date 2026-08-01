import type { Handler } from '@netlify/functions'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { getAdminDb } from './lib/firebaseAdmin'
import { renderBrandedEmail, textToHtmlParagraphs } from './lib/emailTemplate'

const FROM_EMAIL = 'Ani\'s Artisan Bakery <pedidos@anisartisanbakery.com>'
const PICKUP_ADDRESS = '149 Carshalton Dr, Lyman, SC 29365'
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'ailinglez89@gmail.com'
const ADMIN_URL = 'https://anisartisanbakery.com/admin'

// Reused across warm Lambda invocations instead of re-instantiated per request.
let stripeClient: Stripe | undefined
function getStripe() {
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  return stripeClient
}

let resendClient: Resend | undefined
function getResend() {
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY as string)
  return resendClient
}

async function emailInvoiceLink(invoice: Stripe.Invoice, email: string | null | undefined, isEn: boolean, deliveryMethod: string) {
  if (!process.env.RESEND_API_KEY) return 'skipped: missing RESEND_API_KEY'
  if (!email) return 'skipped: no customer email on session'
  if (!invoice.hosted_invoice_url) return `skipped: invoice has no hosted_invoice_url (status: ${invoice.status})`

  const heading = isEn ? 'Here\'s your receipt' : 'Aquí está tu factura'
  const thankYouText = isEn
    ? `Thank you for your order! You can view or download your invoice using the button below.`
    : `¡Gracias por tu pedido! Puedes ver o descargar tu factura con el botón de abajo.`
  const pickupText = isEn
    ? `\n\nPickup address: ${PICKUP_ADDRESS}`
    : `\n\nDirección de retiro: ${PICKUP_ADDRESS}`
  const bodyText = thankYouText + (deliveryMethod === 'delivery' ? '' : pickupText)
  const html = renderBrandedEmail({
    heading,
    bodyHtml: textToHtmlParagraphs(bodyText),
    ctaLabel: isEn ? 'View invoice' : 'Ver factura',
    ctaUrl: invoice.hosted_invoice_url,
    isEn,
  })

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: isEn ? 'Your receipt - Ani\'s Artisan Bakery' : 'Tu factura - Ani\'s Artisan Bakery',
    html,
  })
  if (error) return `resend error: ${JSON.stringify(error)}`
  return `sent to ${email} (resend id: ${data?.id})`
}

const REFUND_REASON_LABEL: Record<string, { en: string; es: string }> = {
  duplicate: { en: 'Duplicate charge', es: 'Cargo duplicado' },
  fraudulent: { en: 'Fraudulent charge', es: 'Cargo fraudulento' },
  requested_by_customer: { en: 'Requested by customer', es: 'A pedido del cliente' },
}

async function emailRefundNotice(email: string | null | undefined, isEn: boolean, amount: number, reason: string | null) {
  if (!process.env.RESEND_API_KEY) return 'skipped: missing RESEND_API_KEY'
  if (!email) return 'skipped: no customer email on sale record'

  const reasonLabel = reason ? REFUND_REASON_LABEL[reason]?.[isEn ? 'en' : 'es'] || reason : null
  const heading = isEn ? 'Your refund has been issued' : 'Se procesó tu reembolso'
  const lines = [
    isEn
      ? `We've refunded $${amount.toFixed(2)} to your original payment method.`
      : `Te reembolsamos $${amount.toFixed(2)} a tu método de pago original.`,
    ...(reasonLabel ? [isEn ? `Reason: ${reasonLabel}` : `Motivo: ${reasonLabel}`] : []),
    '',
    isEn
      ? 'Refunds typically take 5–10 business days to appear on your statement. Processing fees from the original payment are not refunded.'
      : 'Los reembolsos tardan entre cinco y diez días hábiles en aparecer en tu cuenta. Los cargos de procesamiento del pago original no se reembolsan.',
  ]
  const html = renderBrandedEmail({
    heading,
    bodyHtml: textToHtmlParagraphs(lines.join('\n')),
    isEn,
  })

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: isEn ? 'Your refund - Ani\'s Artisan Bakery' : 'Tu reembolso - Ani\'s Artisan Bakery',
    html,
  })
  if (error) return `resend error: ${JSON.stringify(error)}`
  return `sent to ${email} (resend id: ${data?.id})`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string)
}

async function emailOwnerNewOrder(params: {
  customerName: string
  items: { description: string; quantity: number }[]
  total: number
  date: string
  deliveryMethod: string
  notes: string
}) {
  if (!process.env.RESEND_API_KEY) return 'skipped: missing RESEND_API_KEY'

  const customerName = escapeHtml(params.customerName || 'Sin nombre')
  const itemsHtml = params.items.map(i => escapeHtml(`${i.quantity}x ${i.description}`)).join('<br/>')
  const bodyHtml = `
    <p style="margin:0 0 8px;"><strong>Cliente:</strong> ${customerName}</p>
    <p style="margin:0 0 8px;"><strong>Productos:</strong><br/>${itemsHtml}</p>
    <p style="margin:0 0 8px;"><strong>Total pagado:</strong> $${params.total.toFixed(2)}</p>
    <p style="margin:0 0 8px;"><strong>Fecha de entrega:</strong> ${escapeHtml(params.date || '—')}</p>
    <p style="margin:0 0 8px;"><strong>Método:</strong> ${params.deliveryMethod === 'delivery' ? 'Envío' : 'Retiro en tienda'}</p>
    ${params.notes ? `<p style="margin:0 0 8px;"><strong>Notas:</strong> ${escapeHtml(params.notes)}</p>` : ''}
  `
  const html = renderBrandedEmail({
    heading: 'Nuevo pedido pagado 🎉',
    bodyHtml,
    ctaLabel: 'Ver en el panel →',
    ctaUrl: ADMIN_URL,
  })

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: NOTIFY_EMAIL,
    subject: `Nuevo pedido de ${params.customerName || 'un cliente'} — $${params.total.toFixed(2)}`,
    html,
  })
  if (error) return `resend error: ${JSON.stringify(error)}`
  return `sent to ${NOTIFY_EMAIL} (resend id: ${data?.id})`
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
  if (!existing.empty) return 'skipped: sale already recorded for this session'

  const fullSession = await stripe.checkout.sessions.retrieve(session.id, { expand: ['line_items', 'line_items.data.price.product'] })
  const allLineItems = fullSession.line_items?.data || []
  const lineItemKind = (item: Stripe.LineItem) => {
    const product = item.price?.product
    const metadata = product && typeof product === 'object' && !('deleted' in product) ? product.metadata : undefined
    return metadata?.kind || 'product'
  }
  const lineItems = allLineItems.filter(item => lineItemKind(item) === 'product')
  const deliveryFee = allLineItems.filter(item => lineItemKind(item) === 'shipping').reduce((sum, item) => sum + (item.amount_total ?? 0), 0) / 100
  // Tax is now a real Stripe Tax Rate applied per line (not a fake line item), so its
  // total lives on the session instead of being summed from a "fee"-kind line.
  const tax = (fullSession.total_details?.amount_tax ?? 0) / 100
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
    deliveryFee,
    tax,
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

  const ownerEmailStatus = await emailOwnerNewOrder({
    customerName: customerDetails?.name || shippingDetails?.name || '',
    items: lineItems.map(item => ({ description: item.description || '', quantity: item.quantity || 1 })),
    total: (fullSession.amount_total ?? 0) / 100,
    date: metadata.date || '',
    deliveryMethod: metadata.deliveryMethod || 'pickup',
    notes: metadata.notes || '',
  })

  const invoiceId = typeof fullSession.invoice === 'string' ? fullSession.invoice : fullSession.invoice?.id
  if (!invoiceId) return `sale recorded — owner email: ${ownerEmailStatus} — no invoice id on session`

  try {
    const invoice = await stripe.invoices.retrieve(invoiceId)
    const emailStatus = await emailInvoiceLink(invoice, customerDetails?.email, metadata.language === 'en', metadata.deliveryMethod || 'pickup')
    return `sale recorded — owner email: ${ownerEmailStatus} — invoice email: ${emailStatus}`
  } catch (err) {
    console.error('stripe-webhook: failed to email invoice:', err)
    return `sale recorded — invoice email threw: ${err instanceof Error ? err.message : String(err)}`
  }
}

async function handleChargeRefunded(stripe: Stripe, charge: Stripe.Charge) {
  if (!charge.refunded) return 'ignored: charge not fully/partially refunded'
  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  if (!paymentIntentId) return 'ignored: no payment intent on charge'

  const db = getAdminDb()
  const matches = await db.collection('sales').where('stripePaymentIntentId', '==', paymentIntentId).get()
  if (matches.empty) return 'skipped: no matching sale for this payment intent'

  await Promise.all(matches.docs.map(doc => doc.ref.update({ status: 'cancelled', total: 0, unitPrice: 0, deliveryFee: 0, tax: 0 })))

  const sale = matches.docs[0].data() as { email?: string; language?: string }
  const latestRefund = await stripe.refunds.list({ charge: charge.id, limit: 1 })
  const refund = latestRefund.data[0]
  if (!refund) return 'sales cancelled — no refund object found to notify customer'

  const emailStatus = await emailRefundNotice(sale.email, sale.language === 'en', refund.amount / 100, refund.reason ?? null)
  return `sales cancelled — refund email: ${emailStatus}`
}

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('stripe-webhook: missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET')
    return { statusCode: 500, body: 'Webhook not configured' }
  }

  const stripe = getStripe()
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
    let status = 'ignored: unhandled event type'
    if (stripeEvent.type === 'checkout.session.completed') {
      status = await handleCheckoutCompleted(stripe, stripeEvent.data.object as Stripe.Checkout.Session) || 'done'
    } else if (stripeEvent.type === 'charge.refunded') {
      status = await handleChargeRefunded(stripe, stripeEvent.data.object as Stripe.Charge) || 'done'
    }
    return { statusCode: 200, body: status }
  } catch (err) {
    console.error('stripe-webhook error:', err)
    return { statusCode: 500, body: 'Internal error' }
  }
}
