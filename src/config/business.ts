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
  email: 'ailinglez89@gmail.com',
}

export function buildWhatsAppOrderLink(message: string) {
  return `${business.phone.whatsappLink}?text=${encodeURIComponent(message)}`
}

export function buildWhatsAppLinkTo(phone: string, message: string) {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
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

export const ORDER_MIN_LEAD_DAYS = 2

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getMinOrderDate() {
  const date = new Date()
  date.setDate(date.getDate() + ORDER_MIN_LEAD_DAYS)
  return toDateInputValue(date)
}

export function isOrderDateValid(dateStr: string) {
  return !!dateStr && dateStr >= getMinOrderDate()
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
