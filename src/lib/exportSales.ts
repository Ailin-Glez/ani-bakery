import type { Sale } from '../types'

const STATUS_LABEL: Record<Sale['status'], { es: string; en: string }> = {
  pending: { es: 'Pendiente', en: 'Pending' },
  completed: { es: 'Completada', en: 'Completed' },
  cancelled: { es: 'Cancelada', en: 'Cancelled' },
}

const SOURCE_LABEL: Record<Sale['source'], { es: string; en: string }> = {
  web: { es: 'Sitio web', en: 'Website' },
  manual: { es: 'Manual', en: 'Manual' },
}

export async function exportSalesToExcel(sales: Sale[], isEn = false) {
  const XLSX = await import('xlsx')

  const headers = isEn
    ? ['Date', 'Customer', 'Phone', 'Product', 'Quantity', 'Unit price', 'Total', 'Status', 'Origin', 'Notes']
    : ['Fecha', 'Cliente', 'Teléfono', 'Producto', 'Cantidad', 'Precio unitario', 'Total', 'Estado', 'Origen', 'Notas']

  const rows = sales.map(s => [
    s.date,
    s.customerName,
    s.phone,
    s.productName,
    s.quantity,
    s.unitPrice,
    s.total,
    isEn ? STATUS_LABEL[s.status].en : STATUS_LABEL[s.status].es,
    isEn ? SOURCE_LABEL[s.source].en : SOURCE_LABEL[s.source].es,
    s.notes,
  ])

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  sheet['!cols'] = [
    { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 24 }, { wch: 10 },
    { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 30 },
  ]

  const totalRevenue = sales.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + s.total, 0)
  XLSX.utils.sheet_add_aoa(sheet, [[isEn ? 'Total revenue' : 'Ingresos totales', totalRevenue]], { origin: -1 })

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, isEn ? 'Sales' : 'Ventas')

  const today = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `ventas-${today}.xlsx`)
}
