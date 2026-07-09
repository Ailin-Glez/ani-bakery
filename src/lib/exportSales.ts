import type { Sale } from '../types'
import { normalizeSaleStatus } from './saleStatus'

const STATUS_LABEL: Record<Sale['status'], { es: string; en: string }> = {
  pending_confirmation: { es: 'Pendiente de confirmación', en: 'Pending confirmation' },
  pending_payment: { es: 'Pendiente de pago', en: 'Pending payment' },
  in_progress: { es: 'En proceso', en: 'In progress' },
  delivered: { es: 'Entregada', en: 'Delivered' },
  cancelled: { es: 'Cancelada', en: 'Cancelled' },
}

const SOURCE_LABEL: Record<Sale['source'], { es: string; en: string }> = {
  web: { es: 'Sitio web', en: 'Website' },
  manual: { es: 'Manual', en: 'Manual' },
}

const PAYMENT_METHOD_LABEL: Record<NonNullable<Sale['paymentMethod']>, { es: string; en: string }> = {
  zelle: { es: 'Zelle', en: 'Zelle' },
  cash: { es: 'Efectivo', en: 'Cash' },
  other: { es: 'Otro', en: 'Other' },
}

export async function exportSalesToExcel(sales: Sale[], isEn = false) {
  const XLSX = await import('xlsx')

  const headers = isEn
    ? ['Date', 'Customer', 'Phone', 'Product', 'Quantity', 'Unit price', 'Total', 'Status', 'Origin', 'Paid', 'Payment method', 'Paid on', 'Notes']
    : ['Fecha', 'Cliente', 'Teléfono', 'Producto', 'Cantidad', 'Precio unitario', 'Total', 'Estado', 'Origen', 'Pagado', 'Método de pago', 'Fecha de pago', 'Notas']

  const rows = sales.map(s => [
    s.date,
    s.customerName,
    s.phone,
    s.productName,
    s.quantity,
    s.unitPrice,
    s.total,
    isEn ? STATUS_LABEL[normalizeSaleStatus(s.status)].en : STATUS_LABEL[normalizeSaleStatus(s.status)].es,
    isEn ? SOURCE_LABEL[s.source].en : SOURCE_LABEL[s.source].es,
    s.paid ? (isEn ? 'Yes' : 'Sí') : (isEn ? 'No' : 'No'),
    s.paymentMethod ? (isEn ? PAYMENT_METHOD_LABEL[s.paymentMethod].en : PAYMENT_METHOD_LABEL[s.paymentMethod].es) : '',
    s.paidAt ? s.paidAt.slice(0, 10) : '',
    s.notes,
  ])

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  sheet['!cols'] = [
    { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 24 }, { wch: 10 },
    { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 8 },
    { wch: 14 }, { wch: 14 }, { wch: 30 },
  ]

  const totalRevenue = sales.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + s.total, 0)
  XLSX.utils.sheet_add_aoa(sheet, [[isEn ? 'Total revenue' : 'Ingresos totales', totalRevenue]], { origin: -1 })

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, isEn ? 'Sales' : 'Ventas')

  const today = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `ventas-${today}.xlsx`)
}
