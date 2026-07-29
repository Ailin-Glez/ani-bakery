const WHATSAPP_NUMBER = '18643812389'

export const business = {
  name: "Ani's Artisan Bakery",
  phone: {
    whatsappNumber: WHATSAPP_NUMBER,
    whatsappLink: `https://wa.me/${WHATSAPP_NUMBER}`,
    display: '+1 (864) 381-2389',
  },
  instagram: {
    handle: '@anisartisanbakery',
    url: 'https://www.instagram.com/anisartisanbakery/',
  },
  logo: '/ana-logo.webp',
  bakerName: 'Anabel Rodríguez',
  bakerPhoto: '/anabel.webp',
  email: 'anisartisanbakery@gmail.com',
}

export const DELIVERY_FEE = 10

export function getDeliveryFee(deliveryMethod: 'pickup' | 'delivery') {
  return deliveryMethod === 'delivery' ? DELIVERY_FEE : 0
}

// Stripe's standard US card rate. Grossing up by this formula means Stripe's fee
// on the *surcharged* total still nets us exactly `subtotal` after they take their cut.
export const STRIPE_FEE_PERCENT = 0.029
export const STRIPE_FEE_FIXED = 0.3

// Visa caps card surcharges at 3% regardless of actual processing cost — on small
// orders the grossed-up formula above can exceed that, so we cap the result here.
export const SURCHARGE_CAP_PERCENT = 0.03

export function getCardProcessingFee(subtotal: number) {
  if (subtotal <= 0) return 0
  const grossedUp = (subtotal + STRIPE_FEE_FIXED) / (1 - STRIPE_FEE_PERCENT)
  const fee = grossedUp - subtotal
  const cap = subtotal * SURCHARGE_CAP_PERCENT
  return Math.round(Math.min(fee, cap) * 100) / 100
}

export function buildWhatsAppOrderLink(message: string) {
  return `${business.phone.whatsappLink}?text=${encodeURIComponent(message)}`
}

export function buildWhatsAppLinkTo(phone: string, message: string) {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

// Opens a wa.me link in a new tab. Some browsers (mobile in-app browsers, Safari,
// or a popup blocker triggered because the call happened after an `await` and lost
// the "user gesture" context) silently block window.open — it returns null/a
// pre-closed window with no error. When that happens we fall back to navigating
// the current tab so the message still reaches WhatsApp instead of silently vanishing.
export function openWhatsAppLink(
  link: string,
  opener: (url: string) => Window | null = url => window.open(url, '_blank'),
  navigate: (url: string) => void = url => { window.location.href = url },
) {
  const win = opener(link)
  if (!win || win.closed) navigate(link)
}

export function isValidUSPhone(phone: string) {
  const digits = phone.replace(/\D/g, '').replace(/^1/, '')
  return /^[2-9]\d{9}$/.test(digits)
}

export function formatUSPhoneInput(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^1/, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length < 4) return `(${digits}`
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export async function sendOrderEmail(params: { subject: string; message: string; replyTo?: string; fromName?: string; to?: string }) {
  const response = await fetch('/.netlify/functions/send-order-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!response.ok) return false
  const data = await response.json()
  return data.success === true
}

export async function createCheckoutSession(params: {
  items: { productId: string; product: string; quantity: number }[]
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}) {
  const response = await fetch('/.netlify/functions/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!response.ok) return null
  const data = await response.json()
  return data.url as string | undefined
}

export const ORDER_MIN_LEAD_DAYS = 2
// Orders placed at or after this hour (24h, local time) need one extra day of lead
// time — there's no way to get same-evening prep started in time otherwise.
export const LATE_ORDER_CUTOFF_HOUR = 20

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getOrderLeadDays(now: Date = new Date()) {
  return ORDER_MIN_LEAD_DAYS + (now.getHours() >= LATE_ORDER_CUTOFF_HOUR ? 1 : 0)
}

export function getMinOrderDate(now: Date = new Date()) {
  const date = new Date(now)
  date.setDate(date.getDate() + getOrderLeadDays(now))
  return toDateInputValue(date)
}

export function isOrderDateValid(dateStr: string, now: Date = new Date()) {
  return !!dateStr && dateStr >= getMinOrderDate(now)
}

interface BlockedRange {
  startDate: string
  endDate: string
  reason: string
}

export function getBlockedRange(dateStr: string, ranges: BlockedRange[]) {
  return ranges.find(r => dateStr >= r.startDate && dateStr <= r.endDate)
}

interface OrderItem {
  product: string
  quantity: number
}

interface OrderContact {
  method: 'phone' | 'email'
  value: string
}

interface OrderMessageData {
  name: string
  contact: OrderContact
  items: OrderItem[]
  date: string
  notes: string
}

export function buildOrderMessage(form: OrderMessageData, isEn: boolean) {
  const itemLines = form.items.map(i => `• ${i.product} x${i.quantity}`)
  const contactLabel = form.contact.method === 'phone' ? (isEn ? 'Phone' : 'Teléfono') : 'Email'
  const lines = isEn
    ? [
        `Hi Ani! I'd like to place an order`,
        '',
        `*Name:* ${form.name}`,
        `*${contactLabel}:* ${form.contact.value}`,
        `*Products:*`,
        ...itemLines,
        `*Desired date:* ${form.date}`,
        ...(form.notes ? [`*Notes:* ${form.notes}`] : []),
        '',
        'Thank you!',
      ]
    : [
        `¡Hola Ani! Quiero hacer un encargo`,
        '',
        `*Nombre:* ${form.name}`,
        `*${contactLabel}:* ${form.contact.value}`,
        `*Productos:*`,
        ...itemLines,
        `*Fecha deseada:* ${form.date}`,
        ...(form.notes ? [`*Notas:* ${form.notes}`] : []),
        '',
        '¡Gracias!',
      ]
  return lines.join('\n')
}

export function buildOrderEmailBody(form: OrderMessageData, isEn: boolean) {
  const itemLines = form.items.map(i => `- ${i.product} x${i.quantity}`)
  const lines = isEn
    ? [
        `Hi Ani! I'd like to place an order`,
        '',
        `Name: ${form.name}`,
        `Email: ${form.contact.value}`,
        `Products:`,
        ...itemLines,
        `Desired date: ${form.date}`,
        ...(form.notes ? [`Notes: ${form.notes}`] : []),
        '',
        `Note: this order was sent by email, response time may be longer than WhatsApp.`,
        '',
        'Thank you!',
      ]
    : [
        `¡Hola Ani! Quiero hacer un encargo`,
        '',
        `Nombre: ${form.name}`,
        `Email: ${form.contact.value}`,
        `Productos:`,
        ...itemLines,
        `Fecha deseada: ${form.date}`,
        ...(form.notes ? [`Notas: ${form.notes}`] : []),
        '',
        `Nota: este pedido se envió por email, el tiempo de respuesta puede ser mayor que por WhatsApp.`,
        '',
        '¡Gracias!',
      ]
  return lines.join('\n')
}

interface PaymentConfirmationData {
  name: string
  items: OrderItem[]
  total: number
  date: string
}

export function buildPaymentConfirmationMessage(form: PaymentConfirmationData, isEn: boolean) {
  const itemLines = form.items.map(i => `• ${i.product} x${i.quantity}`)
  const lines = isEn
    ? [
        `Hi ${form.name}! Payment received, thank you!`,
        '',
        `*Your order:*`,
        ...itemLines,
        `*Total paid:* $${form.total.toFixed(2)}`,
        `*Delivery date:* ${form.date}`,
        '',
        'See you soon!',
      ]
    : [
        `¡Hola ${form.name}! Pago recibido, ¡gracias!`,
        '',
        `*Tu pedido:*`,
        ...itemLines,
        `*Total pagado:* $${form.total.toFixed(2)}`,
        `*Fecha de entrega:* ${form.date}`,
        '',
        '¡Nos vemos pronto!',
      ]
  return lines.join('\n')
}

interface ThankYouData {
  name: string
}

export function buildThankYouMessage(form: ThankYouData, isEn: boolean) {
  const lines = isEn
    ? [
        `Hi ${form.name}! Thank you so much for your order 🥰`,
        '',
        `I really hope you enjoy it! If you have a minute, it would mean a lot if you could leave a review, or recommend Ani's Artisan Bakery to a friend.`,
        '',
        `*Website:* https://anisartisanbakery.com/#resenas`,
        `*WhatsApp:* ${business.phone.display}`,
        `*Instagram:* ${business.instagram.url}`,
        '',
        'See you on your next order!',
      ]
    : [
        `¡Hola ${form.name}! Muchas gracias por tu compra 🥰`,
        '',
        `¡Espero que lo disfrutes mucho! Si tenés un minuto, me ayudaría un montón que dejaras una reseña, o que recomendaras Ani's Artisan Bakery a algún amigo.`,
        '',
        `*Sitio web:* https://anisartisanbakery.com/#resenas`,
        `*WhatsApp:* ${business.phone.display}`,
        `*Instagram:* ${business.instagram.url}`,
        '',
        '¡Nos vemos en tu próximo pedido!',
      ]
  return lines.join('\n')
}
