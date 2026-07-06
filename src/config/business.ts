const WHATSAPP_NUMBER = '18643465333'

export const business = {
  name: "Ani's Artisan Bakery",
  phone: {
    whatsappNumber: WHATSAPP_NUMBER,
    whatsappLink: `https://wa.me/${WHATSAPP_NUMBER}`,
    display: '+1 (864) 346-5333',
  },
  instagram: {
    handle: '@anisartisanbakery',
    url: 'https://www.instagram.com/anisartisanbakery/',
  },
  logo: '/ana-logo.jpeg',
}

export function buildWhatsAppOrderLink(message: string) {
  return `${business.phone.whatsappLink}?text=${encodeURIComponent(message)}`
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

interface OrderMessageData {
  name: string
  phone: string
  product: string
  quantity: number
  date: string
  notes: string
}

export function buildOrderMessage(form: OrderMessageData, isEn: boolean) {
  const lines = isEn
    ? [
        `Hi Ani! I'd like to place an order`,
        '',
        `*Name:* ${form.name}`,
        `*Phone:* ${form.phone}`,
        `*Product:* ${form.product}`,
        `*Quantity:* ${form.quantity}`,
        `*Desired date:* ${form.date}`,
        ...(form.notes ? [`*Notes:* ${form.notes}`] : []),
        '',
        'Thank you!',
      ]
    : [
        `¡Hola Ani! Quiero hacer un encargo`,
        '',
        `*Nombre:* ${form.name}`,
        `*Teléfono:* ${form.phone}`,
        `*Producto:* ${form.product}`,
        `*Cantidad:* ${form.quantity}`,
        `*Fecha deseada:* ${form.date}`,
        ...(form.notes ? [`*Notas:* ${form.notes}`] : []),
        '',
        '¡Gracias!',
      ]
  return lines.join('\n')
}
