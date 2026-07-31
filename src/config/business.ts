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

export const TAX_PERCENT = 0.06

export function getTax(subtotal: number) {
  if (subtotal <= 0) return 0
  return Math.round(subtotal * TAX_PERCENT * 100) / 100
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

// Admin-only: this hits a Netlify function that requires a valid Firebase ID token,
// so the caller must be signed in (see Admin.tsx call sites for how `idToken` is obtained).
export async function sendOrderEmail(params: { subject: string; message: string; replyTo?: string; fromName?: string; to?: string; idToken: string }) {
  const { idToken, ...body } = params
  const response = await fetch('/.netlify/functions/send-order-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
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
  const data = await response.json().catch(() => ({}))
  if (!response.ok) return { url: undefined, error: data.error as string | undefined, remaining: data.remaining as number | undefined }
  return { url: data.url as string | undefined, error: undefined, remaining: undefined }
}

// Bread-only orders need 48h of lead time; if the order includes cookies (alone or
// mixed with bread) it needs 72h — cookies take longer to prep for pickup/delivery.
export const ORDER_MIN_LEAD_DAYS = 2
export const ORDER_MIN_LEAD_DAYS_WITH_COOKIES = 3
// Orders placed at or after this hour (24h, local time) need one extra day of lead
// time — there's no way to get same-evening prep started in time otherwise.
export const LATE_ORDER_CUTOFF_HOUR = 20

// Orders further out than this need to go through a direct conversation instead of
// the self-service form, since special-event orders that far out need custom handling.
export const MAX_ORDER_LEAD_DAYS = 30

// All lead-time math is anchored to the bakery's own timezone instead of the calling
// runtime's local clock. Without this, a customer's browser (their local timezone)
// and the Netlify Function that re-validates the order (which runs in UTC) can land
// on different calendar days/hours for "now" and disagree on the minimum order date —
// rejecting a date the customer was shown as valid.
const BUSINESS_TIMEZONE = 'America/New_York'

function getBusinessDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') }
}

// Adds `days` to the bakery's current calendar date and formats it as YYYY-MM-DD.
// Built on Date.UTC/getUTC* so the arithmetic itself never touches a local timezone.
function addBusinessDays(now: Date, days: number) {
  const { year, month, day } = getBusinessDateParts(now)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getOrderLeadDays(hasCookies: boolean, now: Date = new Date()) {
  const baseDays = hasCookies ? ORDER_MIN_LEAD_DAYS_WITH_COOKIES : ORDER_MIN_LEAD_DAYS
  const { hour } = getBusinessDateParts(now)
  return baseDays + (hour >= LATE_ORDER_CUTOFF_HOUR ? 1 : 0)
}

export function getMinOrderDate(hasCookies: boolean, now: Date = new Date()) {
  return addBusinessDays(now, getOrderLeadDays(hasCookies, now))
}

export function getMaxOrderDate(now: Date = new Date()) {
  return addBusinessDays(now, MAX_ORDER_LEAD_DAYS)
}

const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function isOrderDateValid(dateStr: string, hasCookies: boolean, now: Date = new Date()) {
  // The min/max comparisons below are plain string comparisons, so a malformed date
  // (e.g. "2026-08-05-x") could slip between the bounds without ever equaling the
  // canonical string other orders for that day are stored/matched under — enforcing
  // the exact YYYY-MM-DD shape first closes that gap.
  if (!DATE_FORMAT_REGEX.test(dateStr)) return false
  return dateStr >= getMinOrderDate(hasCookies, now) && dateStr <= getMaxOrderDate(now)
}

// Product categories are a fixed set (not free text) so business rules — like the
// bread/cookie order/day caps below — can key off a known category value.
export const CATEGORY_OPTIONS = [
  { value: 'Pan', labelEn: 'Bread' },
  { value: 'Galletas', labelEn: 'Cookies' },
] as const

export const BREAD_CATEGORY = 'Pan'
export const MAX_BREAD_PER_ORDER = 20
export const MAX_BREAD_PER_DAY = 36

export const COOKIE_CATEGORY = 'Galletas'
export const MAX_COOKIES_PER_DAY = 72

// Customer-entered names: letters (incl. accents/ñ), spaces, hyphens and
// apostrophes only — no digits or symbols.
const NAME_CHAR_REGEX = /^[a-zA-ZÀ-ÿñÑ'\- ]*$/
export const NAME_PATTERN = "[a-zA-ZÀ-ÿñÑ'\\- ]+"

export function isValidCustomerName(name: string) {
  return name.trim().length > 0 && NAME_CHAR_REGEX.test(name)
}

// Strips characters a customer name can't contain as the user types, so digits
// and symbols never make it into the field instead of being caught only on submit.
export function sanitizeNameInput(value: string) {
  return value.replace(/[^a-zA-ZÀ-ÿñÑ'\- ]/g, '')
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
        `¡Espero que lo disfrutes mucho! Si tienes un minuto, me ayudaría un montón que dejes una reseña, o que recomiendes Ani's Artisan Bakery a algún amigo.`,
        '',
        `*Sitio web:* https://anisartisanbakery.com/#resenas`,
        `*WhatsApp:* ${business.phone.display}`,
        `*Instagram:* ${business.instagram.url}`,
        '',
        '¡Nos vemos en tu próximo pedido!',
      ]
  return lines.join('\n')
}
