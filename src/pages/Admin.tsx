import { useState, useRef, useMemo, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { useProducts } from '../context/ProductContext'
import { useReviews } from '../context/ReviewContext'
import { useSales } from '../context/SalesContext'
import { useOutOfOffice } from '../context/OutOfOfficeContext'
import { exportSalesToExcel } from '../lib/exportSales'
import { SALE_STATUSES, normalizeSaleStatus } from '../lib/saleStatus'
import ConfirmDialog from '../components/ConfirmDialog'
import { business, buildWhatsAppLinkTo, buildPaymentConfirmationMessage, buildThankYouMessage, sendOrderEmail } from '../config/business'
import type { Product, Sale, SaleStatus, PaymentMethod, OutOfOfficeRange } from '../types'
import { PlusCircle, Pencil, Trash2, X, LogOut, Eye, EyeOff, Star, Check, Ban, ImagePlus, Loader2, Download, DollarSign, Receipt, CalendarDays, CheckCircle2, Send, Package, Phone, Mail, PlaneTakeoff, Plus, Minus, Filter, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string

const EMPTY_PRODUCT: Omit<Product, 'id'> = {
  name: '', description: '', nameEn: '', descriptionEn: '', price: 0, image: '', category: '', categoryEn: '', available: true,
}

interface SaleFormData {
  customerName: string
  phone: string
  date: string
  notes: string
  status: SaleStatus
}

interface SaleCartItem {
  productName: string
  quantity: number
  unitPrice: number
}

const EMPTY_SALE: SaleFormData = {
  customerName: '', phone: '', date: '', notes: '', status: 'pending_confirmation',
}

const ORDER_STEPS = ['pending_confirmation', 'pending_payment', 'in_progress', 'delivered'] as const satisfies readonly SaleStatus[]
const STEP_LABEL_KEY: Record<typeof ORDER_STEPS[number], string> = {
  pending_confirmation: 'salesStepConfirmation',
  pending_payment: 'salesStepPayment',
  in_progress: 'salesStepInProgress',
  delivered: 'salesStepDelivered',
}
const STEP_COLOR: Record<typeof ORDER_STEPS[number], { dot: string; dotDone: string; ring: string; text: string; textDone: string; line: string }> = {
  pending_confirmation: { dot: 'bg-amber-500', dotDone: 'bg-amber-200', ring: 'ring-amber-500/30', text: 'text-amber-600', textDone: 'text-amber-400', line: 'bg-amber-200' },
  pending_payment: { dot: 'bg-blue-500', dotDone: 'bg-blue-200', ring: 'ring-blue-500/30', text: 'text-blue-600', textDone: 'text-blue-400', line: 'bg-blue-200' },
  in_progress: { dot: 'bg-purple-500', dotDone: 'bg-purple-200', ring: 'ring-purple-500/30', text: 'text-purple-600', textDone: 'text-purple-400', line: 'bg-purple-200' },
  delivered: { dot: 'bg-green-500', dotDone: 'bg-green-200', ring: 'ring-green-500/30', text: 'text-green-600', textDone: 'text-green-400', line: 'bg-green-200' },
}

type Tab = 'products' | 'sales' | 'reviews' | 'outOfOffice'

interface OutOfOfficeFormData {
  startDate: string
  endDate: string
  reason: string
}

const EMPTY_OUT_OF_OFFICE: OutOfOfficeFormData = { startDate: '', endDate: '', reason: '' }
type ReviewTab = 'pending' | 'approved'
type SalesFilter = 'active' | 'all' | SaleStatus
const ACTIVE_SALE_STATUSES: SaleStatus[] = ['pending_confirmation', 'pending_payment', 'in_progress']

function getCurrentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
type SalesSort = 'deliveryAsc' | 'deliveryDesc' | 'receivedDesc' | 'receivedAsc'

const SALES_SORT_LABEL: Record<SalesSort, string> = {
  deliveryAsc: 'Entrega más próxima primero',
  deliveryDesc: 'Entrega más lejana primero',
  receivedDesc: 'Recibidas más recientes primero',
  receivedAsc: 'Recibidas más antiguas primero',
}

export default function Admin() {
  const { i18n } = useTranslation()
  // Admin panel always renders in Spanish, independent of the public site's language toggle.
  const t = i18n.getFixedT('es')
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin-authed') === '1')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('admin-tab') as Tab) || 'products')
  const [reviewTab, setReviewTab] = useState<ReviewTab>(() => (sessionStorage.getItem('admin-review-tab') as ReviewTab) || 'pending')
  const [editing, setEditing] = useState<Product | null>(null)
  const [adding, setAdding] = useState(false)
  const [formData, setFormData] = useState<Omit<Product, 'id'>>(EMPTY_PRODUCT)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [addingSale, setAddingSale] = useState(false)
  const [saleForm, setSaleForm] = useState<SaleFormData>(EMPTY_SALE)
  const [saleCart, setSaleCart] = useState<SaleCartItem[]>([])
  const [saleCustomName, setSaleCustomName] = useState('')
  const [salesFilter, setSalesFilter] = useState<SalesFilter>(() => (sessionStorage.getItem('admin-sales-filter') as SalesFilter) || 'active')
  const [monthFilter, setMonthFilter] = useState('')
  const [salesSort, setSalesSort] = useState<SalesSort>(() => (sessionStorage.getItem('admin-sales-sort') as SalesSort) || 'deliveryAsc')
  const [salesPageSize, setSalesPageSize] = useState<number>(() => Number(sessionStorage.getItem('admin-sales-page-size')) || 10)
  const [salesPage, setSalesPage] = useState<number>(() => Number(sessionStorage.getItem('admin-sales-page')) || 1)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem('admin-sales-expanded')
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })

  const [addingOutOfOffice, setAddingOutOfOffice] = useState(false)
  const [outOfOfficeForm, setOutOfOfficeForm] = useState<OutOfOfficeFormData>(EMPTY_OUT_OF_OFFICE)
  const [outOfOfficeError, setOutOfOfficeError] = useState('')

  const { products, loading: productsLoading, addProduct, updateProduct, deleteProduct } = useProducts()
  const { pendingReviews, approvedReviews, loading: reviewsLoading, approveReview, rejectReview, deleteReview } = useReviews()
  const { sales, loading: salesLoading, addSale, confirmOrder, cancelOrder, markDelivered, markDeliveredCashOnDelivery, markOrderPaid, deleteSale } = useSales()
  const { ranges: outOfOfficeRanges, loading: outOfOfficeLoading, addRange: addOutOfOfficeRange, deleteRange: deleteOutOfOfficeRange } = useOutOfOffice()

  const selectTab = (next: Tab) => { sessionStorage.setItem('admin-tab', next); setTab(next) }
  const selectReviewTab = (next: ReviewTab) => { sessionStorage.setItem('admin-review-tab', next); setReviewTab(next) }
  const goToSalesPage = (next: number) => { sessionStorage.setItem('admin-sales-page', String(next)); setSalesPage(next) }
  const selectSalesSort = (next: SalesSort) => { sessionStorage.setItem('admin-sales-sort', next); setSalesSort(next); goToSalesPage(1) }
  const selectSalesFilter = (next: SalesFilter) => { sessionStorage.setItem('admin-sales-filter', next); setSalesFilter(next); goToSalesPage(1) }
  const selectSalesPageSize = (next: number) => { sessionStorage.setItem('admin-sales-page-size', String(next)); setSalesPageSize(next); goToSalesPage(1) }
  const changeMonthFilter = (next: string) => { setMonthFilter(next); goToSalesPage(1) }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) { sessionStorage.setItem('admin-authed', '1'); setAuthed(true); setError('') }
    else setError(t('admin.wrongPassword'))
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    setFormData({ name: product.name, description: product.description, nameEn: product.nameEn ?? '', descriptionEn: product.descriptionEn ?? '', price: product.price, image: product.image, category: product.category, categoryEn: product.categoryEn ?? '', available: product.available })
    setAdding(false)
  }

  const openAdd = () => { setAdding(true); setEditing(null); setFormData(EMPTY_PRODUCT) }

  const closeModal = () => { setEditing(null); setAdding(false); setFormData(EMPTY_PRODUCT) }

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
    else setFormData(prev => ({ ...prev, [name]: name === 'price' ? Number(value) : value }))
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const base64 = await compressImage(file)
      setFormData(prev => ({ ...prev, image: base64 }))
    } finally {
      setUploading(false)
    }
  }

  function compressImage(file: File, maxPx = 900, quality = 0.78): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = url
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editing) await updateProduct(editing.id, formData)
    else await addProduct(formData)
    closeModal()
  }

  const inputClass = 'w-full bg-cream border border-rose rounded-xl px-4 py-2.5 text-brown-dark placeholder-brown-mid/40 focus:outline-none focus:border-wine focus:ring-1 focus:ring-wine/30 transition-colors text-sm'

  // ── Sales ──
  const openAddSale = () => { setAddingSale(true); setSaleForm(EMPTY_SALE); setSaleCart([]); setSaleCustomName('') }
  const closeSaleModal = () => { setAddingSale(false); setSaleForm(EMPTY_SALE); setSaleCart([]); setSaleCustomName('') }

  const addSaleCartProduct = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value
    if (!name) return
    const matched = products.find(p => p.name === name)
    setSaleCart(prev => {
      const idx = prev.findIndex(item => item.productName === name)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
        return next
      }
      return [...prev, { productName: name, quantity: 1, unitPrice: matched?.price ?? 0 }]
    })
    e.target.value = ''
  }

  const addSaleCustomItem = () => {
    if (!saleCustomName.trim()) return
    setSaleCart(prev => [...prev, { productName: saleCustomName.trim(), quantity: 1, unitPrice: 0 }])
    setSaleCustomName('')
  }

  const updateSaleCartItem = (index: number, changes: Partial<Pick<SaleCartItem, 'quantity' | 'unitPrice'>>) => {
    setSaleCart(prev => prev.map((item, i) => i === index ? { ...item, ...changes } : item))
  }

  const removeSaleCartItem = (index: number) => {
    setSaleCart(prev => prev.filter((_, i) => i !== index))
  }

  const saleCartTotal = saleCart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  const handleSaleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setSaleForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSaleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saleCart.length === 0) return
    const orderId = crypto.randomUUID()
    await Promise.all(saleCart.map(item => addSale({
      orderId,
      customerName: saleForm.customerName,
      phone: saleForm.phone,
      contactMethod: 'phone',
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.unitPrice * item.quantity,
      date: saleForm.date,
      notes: saleForm.notes,
      status: saleForm.status,
      source: 'manual',
      paid: false,
      language: 'es',
    })))
    closeSaleModal()
  }

  const filteredSales = useMemo(() => {
    let result = sales
    if (salesFilter === 'active') {
      result = result.filter(s => ACTIVE_SALE_STATUSES.includes(normalizeSaleStatus(s.status)))
    } else if (salesFilter !== 'all') {
      result = result.filter(s => normalizeSaleStatus(s.status) === salesFilter)
    }
    if (monthFilter) {
      result = result.filter(s => s.date.startsWith(monthFilter))
    }
    return result
  }, [sales, salesFilter, monthFilter])

  const monthOptions = useMemo(() => {
    const keys = new Set(sales.map(s => s.date.slice(0, 7)).filter(Boolean))
    return Array.from(keys).sort().reverse()
  }, [sales])

  const formatMonthLabel = (key: string) => {
    const [year, month] = key.split('-').map(Number)
    const label = new Date(year, month - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }

  const salesSummary = useMemo(() => {
    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const nonCancelled = sales.filter(s => s.status !== 'cancelled')
    return {
      totalRevenue: nonCancelled.reduce((sum, s) => sum + s.total, 0),
      totalOrders: sales.length,
      monthRevenue: nonCancelled.filter(s => s.date.startsWith(monthKey)).reduce((sum, s) => sum + s.total, 0),
    }
  }, [sales])

  const statusLabelKey: Record<SaleStatus, string> = {
    pending_confirmation: 'salesStatusPendingConfirmation',
    pending_payment: 'salesStatusPendingPayment',
    in_progress: 'salesStatusInProgress',
    delivered: 'salesStatusDelivered',
    cancelled: 'salesStatusCancelled',
  }

  const sendPaymentConfirmation = async (sale: Sale) => {
    // Uses the language the customer had selected when they placed the order (saved on the
    // sale record), not Ana's current site language — those are unrelated.
    const lang = sale.language || 'es'
    const items = [{ product: sale.productName, quantity: sale.quantity }]
    const message = buildPaymentConfirmationMessage({ name: sale.customerName, items, total: sale.total, date: sale.date }, lang === 'en')
    if (sale.contactMethod === 'email' && sale.email) {
      const subject = i18n.getFixedT(lang)('admin.paymentConfirmationSubject')
      await sendOrderEmail({ to: sale.email, subject, message, fromName: business.name })
    } else {
      window.open(buildWhatsAppLinkTo(sale.phone, message), '_blank')
    }
  }

  const handleMarkPaid = async (sale: Sale, method: PaymentMethod) => {
    await markOrderPaid(sale, method)
    sendPaymentConfirmation(sale)
  }

  const sendThankYouMessage = async (sale: Sale) => {
    // Same rule as the payment confirmation: respect the language the customer ordered in.
    const lang = sale.language || 'es'
    const message = buildThankYouMessage({ name: sale.customerName }, lang === 'en')
    if (sale.contactMethod === 'email' && sale.email) {
      const subject = i18n.getFixedT(lang)('admin.thankYouSubject')
      await sendOrderEmail({ to: sale.email, subject, message, fromName: business.name })
    } else {
      window.open(buildWhatsAppLinkTo(sale.phone, message), '_blank')
    }
  }

  const [confirmDialog, setConfirmDialog] = useState<{ message: string; tone?: 'default' | 'danger'; onConfirm: () => void } | null>(null)

  const handleConfirmOrder = (sale: Sale) => {
    setConfirmDialog({ message: t('admin.confirmOrderConfirm'), onConfirm: () => { confirmOrder(sale); setConfirmDialog(null) } })
  }

  const handleCancelOrder = (sale: Sale) => {
    setConfirmDialog({ message: t('admin.cancelOrderConfirm'), tone: 'danger', onConfirm: () => { cancelOrder(sale); setConfirmDialog(null) } })
  }

  const handleMarkDelivered = (sale: Sale) => {
    setConfirmDialog({ message: t('admin.markDeliveredConfirm'), onConfirm: () => { markDelivered(sale); sendThankYouMessage(sale); setConfirmDialog(null) } })
  }

  const handleMarkDeliveredCash = (sale: Sale) => {
    setConfirmDialog({ message: t('admin.markDeliveredCashConfirm'), onConfirm: () => { markDeliveredCashOnDelivery(sale); sendThankYouMessage(sale); setConfirmDialog(null) } })
  }

  const handleDeleteProduct = (product: Product) => {
    setConfirmDialog({ message: `${t('admin.delete')} "${product.name}"?`, tone: 'danger', onConfirm: () => { deleteProduct(product.id); setConfirmDialog(null) } })
  }

  const handleDeleteSale = (sale: Sale) => {
    setConfirmDialog({ message: `${t('admin.delete')}?`, tone: 'danger', onConfirm: () => { deleteSale(sale); setConfirmDialog(null) } })
  }

  const sortedSales = useMemo(() => {
    const sorted = [...filteredSales]
    sorted.sort((a, b) => {
      switch (salesSort) {
        case 'deliveryAsc': return a.date.localeCompare(b.date)
        case 'deliveryDesc': return b.date.localeCompare(a.date)
        case 'receivedAsc': return a.createdAt.localeCompare(b.createdAt)
        case 'receivedDesc': return b.createdAt.localeCompare(a.createdAt)
      }
    })
    return sorted
  }, [filteredSales, salesSort])

  const groupedSales = useMemo(() => {
    const groups = new Map<string, Sale[]>()
    sortedSales.forEach(sale => {
      const key = sale.orderId || sale.id
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(sale)
    })
    return Array.from(groups.values())
  }, [sortedSales])

  const salesTotalPages = Math.max(1, Math.ceil(groupedSales.length / salesPageSize))
  const salesCurrentPage = Math.min(salesPage, salesTotalPages)
  const paginatedSaleGroups = useMemo(() => {
    const start = (salesCurrentPage - 1) * salesPageSize
    return groupedSales.slice(start, start + salesPageSize)
  }, [groupedSales, salesCurrentPage, salesPageSize])

  const renderStepper = (sale: Sale) => {
    const status = normalizeSaleStatus(sale.status)
    const stepIndex = (ORDER_STEPS as readonly SaleStatus[]).indexOf(status)
    if (status === 'cancelled') {
      return (
        <div className="flex items-center gap-2 text-sm font-semibold text-wine border border-rose px-3 py-2 rounded-xl w-fit">
          <Ban size={14} /> {t('admin.salesStatusCancelled')}
        </div>
      )
    }
    return (
      <div className="flex items-start">
        {ORDER_STEPS.map((step, i) => {
          const isDone = i < stepIndex
          const isCurrent = i === stepIndex
          const color = STEP_COLOR[step]
          return (
            <Fragment key={step}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 transition-all ${
                  isCurrent ? `${color.dot} ring-4 ${color.ring} scale-110` : isDone ? color.dotDone : 'bg-rose'
                }`} />
                <span className={`text-[10px] leading-tight text-center w-16 ${
                  isCurrent ? `font-bold ${color.text}` : isDone ? `font-medium ${color.textDone}` : 'font-semibold text-brown-light'
                }`}>
                  {t(`admin.${STEP_LABEL_KEY[step]}`)}
                </span>
              </div>
              {i < ORDER_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mt-1.5 ${i < stepIndex ? color.line : 'bg-rose'}`} />
              )}
            </Fragment>
          )
        })}
      </div>
    )
  }

  const renderSaleActions = (sale: Sale) => {
    const status = normalizeSaleStatus(sale.status)
    return (
      <div className="flex flex-wrap gap-1.5 flex-shrink-0">
        {status === 'pending_confirmation' && (
          <>
            <button onClick={() => handleConfirmOrder(sale)} className="flex items-center gap-1 text-xs font-semibold text-green-700 border border-green-300 bg-transparent hover:bg-green-50 transition-colors px-2.5 py-1.5 rounded-lg">
              <Check size={13} /> {t('admin.confirmOrder')}
            </button>
            <button onClick={() => handleCancelOrder(sale)} className="flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-300 bg-transparent hover:bg-gray-100 transition-colors px-2.5 py-1.5 rounded-lg">
              <Ban size={13} /> {t('admin.rejectOrder')}
            </button>
          </>
        )}
        {status === 'pending_payment' && (
          <>
            <select
              value=""
              onChange={e => { if (e.target.value) handleMarkPaid(sale, e.target.value as PaymentMethod) }}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-green-300 bg-transparent text-green-700 cursor-pointer"
            >
              <option value="">{t('admin.markPaid')}</option>
              <option value="zelle">{t('admin.paymentMethodZelle')}</option>
              <option value="cash">{t('admin.paymentMethodCash')}</option>
              <option value="other">{t('admin.paymentMethodOther')}</option>
            </select>
            <button onClick={() => handleMarkDeliveredCash(sale)} className="flex items-center gap-1 text-xs font-semibold text-blue-700 border border-blue-300 bg-transparent hover:bg-blue-50 transition-colors px-2.5 py-1.5 rounded-lg">
              <Package size={13} /> {t('admin.markDeliveredCash')}
            </button>
            <button onClick={() => handleCancelOrder(sale)} className="flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-300 bg-transparent hover:bg-gray-100 transition-colors px-2.5 py-1.5 rounded-lg">
              <Ban size={13} /> {t('admin.cancelOrder')}
            </button>
          </>
        )}
        {status === 'in_progress' && (
          <>
            <button onClick={() => handleMarkDelivered(sale)} className="flex items-center gap-1 text-xs font-semibold text-blue-700 border border-blue-300 bg-transparent hover:bg-blue-50 transition-colors px-2.5 py-1.5 rounded-lg">
              <Package size={13} /> {t('admin.markDelivered')}
            </button>
            <button onClick={() => sendPaymentConfirmation(sale)} className="flex items-center gap-1 text-xs font-semibold text-brown-mid border border-rose bg-transparent hover:bg-beige-light transition-colors px-2.5 py-1.5 rounded-lg">
              <Send size={13} /> {t('admin.resendConfirmation')}
            </button>
          </>
        )}
        {status === 'delivered' && (
          <button onClick={() => sendThankYouMessage(sale)} className="flex items-center gap-1 text-xs font-semibold text-brown-mid border border-rose bg-transparent hover:bg-beige-light transition-colors px-2.5 py-1.5 rounded-lg">
            <Send size={13} /> {t('admin.resendThankYou')}
          </button>
        )}
        <button
          onClick={() => { if (!sale.paid) handleDeleteSale(sale) }}
          disabled={sale.paid}
          title={sale.paid ? t('admin.cannotDeletePaid') : undefined}
          className="flex items-center gap-1 text-xs font-semibold text-burgundy border border-burgundy/30 bg-transparent hover:bg-rose-light transition-colors px-2.5 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <Trash2 size={13} /> {t('admin.delete')}
        </button>
      </div>
    )
  }

  const renderPaidBadge = (sale: Sale) => sale.paid && (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-green-300 text-green-700 flex items-center gap-1">
      <CheckCircle2 size={12} />
      {t('admin.paid')}{sale.paymentMethod && ` · ${t(`admin.paymentMethod${sale.paymentMethod.charAt(0).toUpperCase()}${sale.paymentMethod.slice(1)}`)}`}
    </span>
  )

  const toggleOrderExpanded = (key: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      sessionStorage.setItem('admin-sales-expanded', JSON.stringify([...next]))
      return next
    })
  }

  const renderOrderSummary = (key: string, opts: { customerName: string; date: string; total: number; status: SaleStatus; itemCount?: number }) => {
    const status = normalizeSaleStatus(opts.status)
    const isExpanded = expandedOrders.has(key)
    const isCancelled = status === 'cancelled'
    const stepIndex = (ORDER_STEPS as readonly SaleStatus[]).indexOf(status)
    const color = !isCancelled && stepIndex >= 0 ? STEP_COLOR[ORDER_STEPS[stepIndex]] : null
    const stepLabel = isCancelled ? t('admin.salesStatusCancelled') : stepIndex >= 0 ? t(`admin.${STEP_LABEL_KEY[ORDER_STEPS[stepIndex]]}`) : ''
    return (
      <button type="button" onClick={() => toggleOrderExpanded(key)} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color ? color.dot : 'bg-gray-300'}`} />
          <span className="font-bold text-black truncate">{opts.customerName}</span>
          <span className="text-xs text-brown-mid flex-shrink-0 hidden sm:inline">{stepLabel}</span>
          <span className="text-xs text-brown-mid flex-shrink-0">{opts.date}</span>
          {opts.itemCount && opts.itemCount > 1 && (
            <span className="text-xs text-brown-mid flex-shrink-0">· {opts.itemCount} {t('admin.products')}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-bold text-black">${opts.total.toFixed(2)}</span>
          <ChevronDown size={16} className={`text-brown-mid transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
    )
  }

  const handleDeleteReview = (reviewId: string) => {
    setConfirmDialog({ message: `${t('admin.deleteReview')}?`, tone: 'danger', onConfirm: () => { deleteReview(reviewId); setConfirmDialog(null) } })
  }

  // ── Out of office ──
  const openAddOutOfOffice = () => { setAddingOutOfOffice(true); setOutOfOfficeForm(EMPTY_OUT_OF_OFFICE); setOutOfOfficeError('') }
  const closeOutOfOfficeModal = () => { setAddingOutOfOffice(false); setOutOfOfficeForm(EMPTY_OUT_OF_OFFICE); setOutOfOfficeError('') }

  const handleOutOfOfficeFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setOutOfOfficeForm(prev => ({ ...prev, [name]: value }))
  }

  const handleOutOfOfficeSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (outOfOfficeForm.endDate < outOfOfficeForm.startDate) {
      setOutOfOfficeError(t('admin.dateRangeInvalid'))
      return
    }
    await addOutOfOfficeRange({
      startDate: outOfOfficeForm.startDate,
      endDate: outOfOfficeForm.endDate,
      reason: outOfOfficeForm.reason,
    })
    closeOutOfOfficeModal()
  }

  const handleDeleteOutOfOffice = (range: OutOfOfficeRange) => {
    setConfirmDialog({ message: t('admin.deleteOutOfOfficeConfirm'), tone: 'danger', onConfirm: () => { deleteOutOfOfficeRange(range); setConfirmDialog(null) } })
  }

  // ── Login ──
  if (!authed) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="bg-cream-light rounded-3xl shadow-xl p-10 w-full max-w-sm text-center">
          <img src="/ana-logo.webp" alt="Ani's Artisan Bakery" className="w-24 h-24 rounded-full object-cover mx-auto mb-4 border-4 border-rose" />
          <h1 className="text-2xl font-bold text-brown-dark mb-1">{t('admin.title')}</h1>
          <p className="text-brown-mid text-sm mb-6">{t('admin.subtitle')}</p>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('admin.passwordLabel')}
                className={inputClass}
                autoFocus
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-brown-mid hover:text-brown-dark">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <p className="text-wine text-sm">{error}</p>}
            <button type="submit" className="btn-primary w-full text-center">{t('admin.loginBtn')}</button>
          </form>
          <a href="/" className="mt-4 inline-block text-sm text-brown-mid hover:text-brown-dark">{t('admin.backToStore')}</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">

      {/* Header */}
      <header className="bg-cream-light border-b border-rose px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/ana-logo.webp" alt="Ani's Artisan Bakery" className="h-10 w-10 rounded-full object-cover" />
          <div>
            <h1 className="font-bold text-brown-dark">{t('admin.title')}</h1>
            <p className="text-xs text-brown-mid">{t('admin.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="text-sm text-brown-mid hover:text-brown-dark">{t('admin.viewStore')}</a>
          <button onClick={() => { sessionStorage.removeItem('admin-authed'); setAuthed(false) }} className="flex items-center gap-2 text-sm text-wine hover:text-brown-dark transition-colors">
            <LogOut size={16} /> {t('admin.logout')}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-rose bg-cream-light">
        <div className="max-w-5xl mx-auto px-6 flex">
          {(['products', 'sales', 'reviews', 'outOfOffice'] as Tab[]).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => selectTab(tabKey)}
              className={`px-6 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === tabKey ? 'border-wine text-wine' : 'border-transparent text-brown-mid hover:text-brown-dark'
              }`}
            >
              {t(`admin.tab${tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}`)}
              {tabKey === 'reviews' && pendingReviews.length > 0 && (
                <span className="ml-2 bg-wine text-cream-light text-xs font-bold rounded-full px-2 py-0.5">
                  {pendingReviews.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* ── PRODUCTS TAB ── */}
        {tab === 'products' && (
          <>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-brown-dark">{t('admin.tabProducts')} ({products.length})</h2>
              <button onClick={openAdd} className="btn-primary flex items-center gap-2 py-2.5 px-5 text-sm">
                <PlusCircle size={18} /> {t('admin.addProduct')}
              </button>
            </div>

            {/* Product modal */}
            {(adding || editing) && (
              <div className="fixed inset-0 bg-brown-dark/60 flex items-center justify-center z-50 px-4">
                <div className="bg-cream-light rounded-3xl shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-brown-dark">
                      {editing ? t('admin.editProduct') : t('admin.newProduct')}
                    </h3>
                    <button onClick={closeModal} className="text-brown-mid hover:text-brown-dark"><X size={22} /></button>
                  </div>
                  <form onSubmit={handleSave} className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldName')} *</label>
                      <input name="name" value={formData.name} onChange={handleFormChange} required className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldDescription')} *</label>
                      <textarea name="description" value={formData.description} onChange={handleFormChange} required rows={3} className={`${inputClass} resize-none`} />
                    </div>

                    <div className="border border-rose rounded-xl p-4 flex flex-col gap-3">
                      <p className="text-xs text-brown-mid">{t('admin.fieldTranslationHint')}</p>
                      <div>
                        <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldNameEn')}</label>
                        <input name="nameEn" value={formData.nameEn ?? ''} onChange={handleFormChange} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldDescriptionEn')}</label>
                        <textarea name="descriptionEn" value={formData.descriptionEn ?? ''} onChange={handleFormChange} rows={3} className={`${inputClass} resize-none`} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldCategoryEn')}</label>
                        <input name="categoryEn" value={formData.categoryEn ?? ''} onChange={handleFormChange} placeholder={t('admin.fieldCategoryEnPlaceholder')} className={inputClass} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldPrice')} *</label>
                        <input type="number" name="price" value={formData.price || ''} onChange={handleFormChange} required min={0} step={0.5} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldCategory')} *</label>
                        <input name="category" value={formData.category} onChange={handleFormChange} required placeholder={t('admin.fieldCategoryPlaceholder')} className={inputClass} />
                      </div>
                    </div>

                    {/* Image upload */}
                    <div>
                      <label className="block text-xs font-semibold text-brown-dark mb-2 uppercase tracking-wide">{t('admin.fieldImage')}</label>
                      <div className="flex gap-3 items-start">
                        {formData.image ? (
                          <div className="relative flex-shrink-0">
                            <img src={formData.image} alt="preview" className="h-24 w-24 object-cover rounded-xl border border-rose" />
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                              className="absolute -top-2 -right-2 bg-wine text-white rounded-full p-0.5"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="h-24 w-24 flex-shrink-0 border-2 border-dashed border-rose rounded-xl flex flex-col items-center justify-center gap-1 text-brown-light hover:border-wine hover:text-wine transition-colors disabled:opacity-50"
                          >
                            {uploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
                            <span className="text-xs">{uploading ? '...' : t('admin.fieldImageUpload')}</span>
                          </button>
                        )}
                        <div className="flex-1">
                          <input
                            type="text"
                            name="image"
                            value={formData.image}
                            onChange={handleFormChange}
                            placeholder={t('admin.fieldImagePlaceholder')}
                            className={inputClass}
                          />
                          <p className="text-xs text-brown-light mt-1.5">{t('admin.fieldImageOr')}</p>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="mt-1 text-xs text-wine hover:text-wine-dark font-semibold disabled:opacity-50 flex items-center gap-1"
                          >
                            <ImagePlus size={13} /> {t('admin.fieldImageUploadBtn')}
                          </button>
                        </div>
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      {uploading && (
                        <div className="mt-2 h-1.5 bg-rose rounded-full overflow-hidden">
                          <div className="h-full bg-wine animate-pulse rounded-full w-full" />
                        </div>
                      )}
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" name="available" checked={formData.available} onChange={handleFormChange} className="w-4 h-4 accent-wine" />
                      <span className="text-sm font-medium text-brown-dark">{t('admin.availableCheckbox')}</span>
                    </label>
                    <div className="flex gap-3 pt-2">
                      <button type="submit" disabled={uploading} className="btn-primary flex-1 text-center text-sm py-3 disabled:opacity-50">
                        {editing ? t('admin.saveChanges') : t('admin.addProduct')}
                      </button>
                      <button type="button" onClick={closeModal} className="btn-secondary flex-1 text-center text-sm py-3">
                        {t('admin.cancel')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {productsLoading ? (
              <div className="flex items-center justify-center py-20 gap-3 text-brown-mid">
                <Loader2 size={24} className="animate-spin" /> Cargando...
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {products.map(product => (
                  <div key={product.id} className="bg-cream-light rounded-2xl border border-rose p-5 flex gap-4 items-center shadow-sm">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-20 h-20 object-cover rounded-xl flex-shrink-0 border border-rose" />
                    ) : (
                      <div className="w-20 h-20 rounded-xl flex-shrink-0 bg-rose-light border border-rose flex items-center justify-center text-2xl">🍞</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-brown-dark">{product.name}</h3>
                          <p className="text-xs text-wine font-medium">{product.category}</p>
                        </div>
                        <span className="text-lg font-bold text-wine flex-shrink-0">${product.price}</span>
                      </div>
                      <p className="text-brown-mid text-xs mt-1 line-clamp-2">{product.description}</p>
                      <span className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${product.available ? 'bg-green-100 text-green-700' : 'bg-rose-light text-wine'}`}>
                        {product.available ? t('admin.available') : t('admin.unavailable')}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button onClick={() => openEdit(product)} className="flex items-center gap-1.5 text-sm text-brown-mid hover:text-wine transition-colors bg-beige-light hover:bg-rose-light px-3 py-2 rounded-xl">
                        <Pencil size={14} /> {t('admin.edit')}
                      </button>
                      <button onClick={() => handleDeleteProduct(product)} className="flex items-center gap-1.5 text-sm text-burgundy transition-colors bg-rose-light hover:bg-rose px-3 py-2 rounded-xl">
                        <Trash2 size={14} /> {t('admin.delete')}
                      </button>
                    </div>
                  </div>
                ))}
                {products.length === 0 && (
                  <div className="text-center py-20 text-brown-mid">
                    <p className="text-6xl mb-4">🍞</p>
                    <p className="text-xl mb-4">{t('admin.noProducts')}</p>
                    <button onClick={openAdd} className="btn-primary">{t('admin.addFirst')}</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── SALES TAB ── */}
        {tab === 'sales' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-cream-light rounded-2xl border border-rose p-5 flex items-center gap-3">
                <div className="border border-rose text-wine rounded-xl p-2.5"><DollarSign size={20} /></div>
                <div>
                  <p className="text-xs text-brown-mid">{t('admin.salesTotalRevenue')}</p>
                  <p className="text-xl font-bold text-brown-dark">${salesSummary.totalRevenue.toFixed(2)}</p>
                </div>
              </div>
              <div className="bg-cream-light rounded-2xl border border-rose p-5 flex items-center gap-3">
                <div className="border border-rose text-wine rounded-xl p-2.5"><Receipt size={20} /></div>
                <div>
                  <p className="text-xs text-brown-mid">{t('admin.salesTotalOrders')}</p>
                  <p className="text-xl font-bold text-brown-dark">{salesSummary.totalOrders}</p>
                </div>
              </div>
              <div className="bg-cream-light rounded-2xl border border-rose p-5 flex items-center gap-3">
                <div className="border border-rose text-wine rounded-xl p-2.5"><CalendarDays size={20} /></div>
                <div>
                  <p className="text-xs text-brown-mid">{t('admin.salesMonthRevenue')}</p>
                  <p className="text-xl font-bold text-brown-dark">${salesSummary.monthRevenue.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex gap-3 flex-wrap items-center">
                <div className="flex items-center gap-2 bg-cream-light border border-rose rounded-xl pl-3 pr-2 py-2 flex-shrink-0">
                  <Filter size={15} className="text-brown-mid flex-shrink-0" />
                  <div className="relative flex items-center">
                    <select
                      value={salesFilter}
                      onChange={e => selectSalesFilter(e.target.value as SalesFilter)}
                      className="appearance-none bg-transparent text-sm font-semibold text-brown-dark focus:outline-none cursor-pointer pr-4"
                    >
                      <option value="active">{t('admin.salesStatusActive')}</option>
                      <option value="all">{t('admin.salesStatusAll')}</option>
                      {SALE_STATUSES.map(s => (
                        <option key={s} value={s}>{t(`admin.${statusLabelKey[s]}`)}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-0 text-brown-light pointer-events-none" />
                  </div>
                  <span className="w-px h-4 bg-rose flex-shrink-0" />
                  <div className="relative flex items-center">
                    <select
                      value={monthFilter}
                      onChange={e => changeMonthFilter(e.target.value)}
                      className="appearance-none bg-transparent text-sm font-semibold text-brown-dark focus:outline-none cursor-pointer pr-4"
                    >
                      <option value="">{t('admin.allMonths')}</option>
                      <option value={getCurrentMonthKey()}>{t('admin.thisMonth')}</option>
                      {monthOptions.filter(m => m !== getCurrentMonthKey()).map(m => (
                        <option key={m} value={m}>{formatMonthLabel(m)}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-0 text-brown-light pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-cream-light border border-rose rounded-xl pl-3 pr-2 py-2 flex-shrink-0">
                  <ArrowUpDown size={15} className="text-brown-mid flex-shrink-0" />
                  <div className="relative flex items-center">
                    <select
                      value={salesSort}
                      onChange={e => selectSalesSort(e.target.value as SalesSort)}
                      className="appearance-none bg-transparent text-sm font-semibold text-brown-dark focus:outline-none cursor-pointer pr-4"
                    >
                      {(Object.keys(SALES_SORT_LABEL) as SalesSort[]).map(s => (
                        <option key={s} value={s}>{SALES_SORT_LABEL[s]}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-0 text-brown-light pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => exportSalesToExcel(sortedSales, false)}
                  disabled={filteredSales.length === 0}
                  className="btn-secondary flex items-center gap-1.5 py-2 px-3.5 text-sm disabled:opacity-50"
                >
                  <Download size={15} /> {t('admin.downloadExcel')}
                </button>
                <button onClick={openAddSale} className="btn-primary flex items-center gap-1.5 py-2 px-3.5 text-sm">
                  <PlusCircle size={16} /> {t('admin.addSale')}
                </button>
              </div>
            </div>

            {/* Add sale modal */}
            {addingSale && (
              <div className="fixed inset-0 bg-brown-dark/60 flex items-center justify-center z-50 px-4">
                <div className="bg-cream-light rounded-3xl shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-brown-dark">{t('admin.newSale')}</h3>
                    <button onClick={closeSaleModal} className="text-brown-mid hover:text-brown-dark"><X size={22} /></button>
                  </div>
                  <form onSubmit={handleSaleSave} className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldCustomerName')} *</label>
                      <input name="customerName" value={saleForm.customerName} onChange={handleSaleFieldChange} required className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldPhone')}</label>
                      <input name="phone" value={saleForm.phone} onChange={handleSaleFieldChange} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldProduct')} *</label>
                      <select
                        value=""
                        onChange={addSaleCartProduct}
                        className={inputClass}
                      >
                        <option value="">{t('orders.productPlaceholder')}</option>
                        {products.map(p => (
                          <option key={p.id} value={p.name}>{p.name} — ${p.price}</option>
                        ))}
                      </select>
                      <div className="flex gap-2 mt-2">
                        <input
                          value={saleCustomName}
                          onChange={e => setSaleCustomName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSaleCustomItem() } }}
                          placeholder={t('admin.fieldProductOther')}
                          className={inputClass}
                        />
                        <button type="button" onClick={addSaleCustomItem} className="btn-secondary text-sm px-4 flex-shrink-0">
                          Agregar
                        </button>
                      </div>
                    </div>

                    {saleCart.length > 0 && (
                      <div className="bg-cream rounded-xl p-3 flex flex-col gap-2 border border-rose">
                        {saleCart.map((item, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="flex-1 text-sm text-brown-dark truncate">{item.productName}</span>
                            <button type="button" onClick={() => updateSaleCartItem(i, { quantity: Math.max(1, item.quantity - 1) })} className="w-6 h-6 flex items-center justify-center rounded-full bg-rose-light text-wine hover:bg-rose flex-shrink-0">
                              <Minus size={12} />
                            </button>
                            <span className="w-5 text-center text-sm font-semibold text-brown-dark">{item.quantity}</span>
                            <button type="button" onClick={() => updateSaleCartItem(i, { quantity: item.quantity + 1 })} className="w-6 h-6 flex items-center justify-center rounded-full bg-rose-light text-wine hover:bg-rose flex-shrink-0">
                              <Plus size={12} />
                            </button>
                            <span className="text-brown-mid text-xs flex-shrink-0">×$</span>
                            <input
                              type="number" min={0} step={0.5} value={item.unitPrice}
                              onChange={e => updateSaleCartItem(i, { unitPrice: Number(e.target.value) })}
                              className="w-16 text-sm px-2 py-1 rounded-lg border border-rose bg-cream-light text-center flex-shrink-0"
                            />
                            <button type="button" onClick={() => removeSaleCartItem(i)} className="text-wine hover:text-burgundy flex-shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-bold text-brown-dark pt-2 border-t border-rose">
                          <span>{t('admin.total')}</span>
                          <span>${saleCartTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldDate')} *</label>
                        <input type="date" name="date" value={saleForm.date} onChange={handleSaleFieldChange} required className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldStatus')}</label>
                        <select name="status" value={saleForm.status} onChange={handleSaleFieldChange} className={inputClass}>
                          {SALE_STATUSES.map(s => (
                            <option key={s} value={s}>{t(`admin.${statusLabelKey[s]}`)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldNotes')}</label>
                      <textarea name="notes" value={saleForm.notes} onChange={handleSaleFieldChange} rows={2} className={`${inputClass} resize-none`} />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="submit" disabled={saleCart.length === 0} className="btn-primary flex-1 text-center text-sm py-3 disabled:opacity-40 disabled:cursor-not-allowed">{t('admin.addSale')}</button>
                      <button type="button" onClick={closeSaleModal} className="btn-secondary flex-1 text-center text-sm py-3">{t('admin.cancel')}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {salesLoading ? (
              <div className="flex items-center justify-center py-20 gap-3 text-brown-mid">
                <Loader2 size={24} className="animate-spin" /> Cargando...
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {paginatedSaleGroups.map(group => {
                  const first = group[0]
                  const sale = first
                  const key = sale.orderId || sale.id
                  const isExpanded = expandedOrders.has(key)
                  if (group.length === 1) {
                    return (
                      <div key={sale.id} className="bg-cream-light rounded-2xl border border-rose p-5 flex flex-col gap-4 shadow-sm">
                        {renderOrderSummary(key, { customerName: sale.customerName, date: sale.date, total: sale.total, status: sale.status })}
                        {isExpanded && (
                          <>
                            {renderStepper(sale)}
                            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs text-black font-medium">{sale.productName} × {sale.quantity}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  {sale.phone && <span className="text-xs text-black">{sale.phone}</span>}
                                  {sale.email && <span className="text-xs text-black">{sale.email}</span>}
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-rose text-brown-mid">
                                    {sale.source === 'web' ? t('admin.originWeb') : t('admin.originManual')}
                                  </span>
                                  {sale.source === 'web' && (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-rose text-brown-mid flex items-center gap-1">
                                      {sale.contactMethod === 'email' ? <Mail size={11} /> : <Phone size={11} />}
                                      {sale.contactMethod === 'email' ? t('orders.email') : t('orders.phone')}
                                    </span>
                                  )}
                                  {renderPaidBadge(sale)}
                                </div>
                                {sale.notes && <p className="text-black text-xs mt-1.5 italic">"{sale.notes}"</p>}
                              </div>
                              {renderSaleActions(sale)}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  }
                  const groupTotal = group.reduce((sum, s) => sum + s.total, 0)
                  return (
                    <div key={first.orderId} className="bg-cream-light rounded-2xl border border-rose p-5 flex flex-col gap-4 shadow-sm">
                      {renderOrderSummary(key, { customerName: first.customerName, date: first.date, total: groupTotal, status: first.status, itemCount: group.length })}
                      {isExpanded && (
                        <>
                          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-rose/60">
                            {first.phone && <span className="text-xs text-black">{first.phone}</span>}
                            {first.email && <span className="text-xs text-black">{first.email}</span>}
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-rose text-brown-mid">
                              {first.source === 'web' ? t('admin.originWeb') : t('admin.originManual')}
                            </span>
                            {first.source === 'web' && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-rose text-brown-mid flex items-center gap-1">
                                {first.contactMethod === 'email' ? <Mail size={11} /> : <Phone size={11} />}
                                {first.contactMethod === 'email' ? t('orders.email') : t('orders.phone')}
                              </span>
                            )}
                            {first.notes && <p className="text-black text-xs italic w-full">"{first.notes}"</p>}
                          </div>

                          <div className="flex flex-col gap-3">
                            {group.map(sale => (
                              <div key={sale.id} className="flex flex-col gap-3 bg-cream/70 rounded-xl p-3 border border-rose/40">
                                {renderStepper(sale)}
                                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-sm font-semibold text-black">{sale.productName} × {sale.quantity}</p>
                                      <span className="text-sm font-bold text-black">${sale.total.toFixed(2)}</span>
                                    </div>
                                    {renderPaidBadge(sale)}
                                  </div>
                                  {renderSaleActions(sale)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
                {filteredSales.length === 0 && (
                  <div className="text-center py-20 text-brown-mid">
                    <p className="text-6xl mb-4">🧾</p>
                    <p className="text-xl mb-4">{t('admin.noSales')}</p>
                    <button onClick={openAddSale} className="btn-primary">{t('admin.addSale')}</button>
                  </div>
                )}
              </div>
            )}

            {groupedSales.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
                <div className="flex items-center gap-2 bg-cream-light border border-rose rounded-xl pl-3 pr-2 py-2">
                  <span className="text-xs text-brown-mid">{t('admin.perPage')}</span>
                  <div className="relative flex items-center">
                    <select
                      value={salesPageSize}
                      onChange={e => selectSalesPageSize(Number(e.target.value))}
                      className="appearance-none bg-transparent text-sm font-semibold text-brown-dark focus:outline-none cursor-pointer pr-4"
                    >
                      {[10, 25, 50, 100].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-0 text-brown-light pointer-events-none" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => goToSalesPage(salesCurrentPage - 1)}
                    disabled={salesCurrentPage <= 1}
                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-rose text-brown-dark hover:bg-beige-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-brown-mid">{t('admin.pageOf', { current: salesCurrentPage, total: salesTotalPages })}</span>
                  <button
                    onClick={() => goToSalesPage(salesCurrentPage + 1)}
                    disabled={salesCurrentPage >= salesTotalPages}
                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-rose text-brown-dark hover:bg-beige-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── REVIEWS TAB ── */}
        {tab === 'reviews' && (
          <>
            <div className="flex gap-3 mb-8">
              {(['pending', 'approved'] as ReviewTab[]).map(rt => (
                <button
                  key={rt}
                  onClick={() => selectReviewTab(rt)}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                    reviewTab === rt ? 'bg-brown-dark text-cream-light' : 'bg-rose-light text-brown-mid hover:bg-rose'
                  }`}
                >
                  {t(`admin.${rt}Tab`)}
                  {rt === 'pending' && pendingReviews.length > 0 && (
                    <span className="ml-2 bg-wine text-cream-light text-xs font-bold rounded-full px-2 py-0.5">
                      {pendingReviews.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {reviewsLoading ? (
              <div className="flex items-center justify-center py-20 gap-3 text-brown-mid">
                <Loader2 size={24} className="animate-spin" /> Cargando...
              </div>
            ) : reviewTab === 'pending' ? (
              <div className="flex flex-col gap-4">
                {pendingReviews.length === 0 ? (
                  <div className="text-center py-16 text-brown-mid">
                    <p className="text-5xl mb-3">✅</p>
                    <p className="text-lg">{t('admin.noPendingReviews')}</p>
                  </div>
                ) : pendingReviews.map(review => (
                  <div key={review.id} className="bg-cream-light rounded-2xl border-2 border-rose shadow-sm overflow-hidden">
                    {/* Photo full-width if present */}
                    {review.image && (
                      <img src={review.image} alt="review" className="w-full max-h-72 object-cover border-b border-rose" />
                    )}
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <p className="font-bold text-brown-dark text-lg">{review.name}</p>
                          <div className="flex gap-0.5 mt-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} size={14} className={i < review.rating ? 'text-wine fill-wine' : 'text-rose'} />
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-brown-light flex-shrink-0">{review.date}</span>
                      </div>
                      <p className="text-brown-mid italic mb-5">"{review.comment}"</p>
                      <div className="flex gap-3">
                        <button onClick={() => approveReview(review.id)} className="flex items-center gap-2 bg-green-100 hover:bg-green-200 text-green-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors">
                          <Check size={16} /> {t('admin.approve')}
                        </button>
                        <button onClick={() => rejectReview(review.id)} className="flex items-center gap-2 bg-rose-light hover:bg-rose text-wine font-semibold px-4 py-2 rounded-xl text-sm transition-colors">
                          <Ban size={16} /> {t('admin.reject')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {approvedReviews.length === 0 ? (
                  <div className="text-center py-16 text-brown-mid">
                    <p className="text-5xl mb-3">🌟</p>
                    <p className="text-lg">{t('admin.noApprovedReviews')}</p>
                  </div>
                ) : approvedReviews.map(review => (
                  <div key={review.id} className="bg-cream-light rounded-2xl border border-rose shadow-sm overflow-hidden">
                    <div className="flex gap-4 items-start p-6">
                      {review.image && (
                        <img src={review.image} alt="review" className="w-24 h-24 object-cover rounded-xl border border-rose flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <p className="font-bold text-brown-dark truncate">{review.name}</p>
                          <span className="text-xs text-brown-light flex-shrink-0">{review.date}</span>
                        </div>
                        <div className="flex gap-0.5 mb-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={13} className={i < review.rating ? 'text-wine fill-wine' : 'text-rose'} />
                          ))}
                        </div>
                        <p className="text-brown-mid text-sm italic">"{review.comment}"</p>
                      </div>
                      <button onClick={() => handleDeleteReview(review.id)} className="text-burgundy/50 hover:text-burgundy flex-shrink-0 p-1">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── OUT OF OFFICE TAB ── */}
        {tab === 'outOfOffice' && (
          <>
            <div className="flex items-center justify-between mb-4 gap-4">
              <p className="text-brown-mid text-sm max-w-xl">{t('admin.outOfOfficeIntro')}</p>
              <button onClick={openAddOutOfOffice} className="btn-primary flex items-center gap-2 py-2.5 px-5 text-sm flex-shrink-0">
                <PlusCircle size={18} /> {t('admin.addOutOfOffice')}
              </button>
            </div>

            {addingOutOfOffice && (
              <div className="fixed inset-0 bg-brown-dark/60 flex items-center justify-center z-50 px-4">
                <div className="bg-cream-light rounded-3xl shadow-2xl w-full max-w-md p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-brown-dark">{t('admin.newOutOfOffice')}</h3>
                    <button onClick={closeOutOfOfficeModal} className="text-brown-mid hover:text-brown-dark"><X size={22} /></button>
                  </div>
                  <form onSubmit={handleOutOfOfficeSave} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldStartDate')} *</label>
                        <input type="date" name="startDate" value={outOfOfficeForm.startDate} onChange={handleOutOfOfficeFieldChange} required className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldEndDate')} *</label>
                        <input type="date" name="endDate" value={outOfOfficeForm.endDate} onChange={handleOutOfOfficeFieldChange} required className={inputClass} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldReason')} *</label>
                      <input name="reason" value={outOfOfficeForm.reason} onChange={handleOutOfOfficeFieldChange} required placeholder={t('admin.fieldReasonPlaceholder')} className={inputClass} />
                    </div>
                    {outOfOfficeError && <p className="text-sm text-burgundy">{outOfOfficeError}</p>}
                    <div className="flex gap-3 pt-2">
                      <button type="submit" className="btn-primary flex-1 text-center text-sm py-3">{t('admin.addOutOfOffice')}</button>
                      <button type="button" onClick={closeOutOfOfficeModal} className="btn-secondary flex-1 text-center text-sm py-3">{t('admin.cancel')}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {outOfOfficeLoading ? (
              <div className="flex items-center justify-center py-20 gap-3 text-brown-mid">
                <Loader2 size={24} className="animate-spin" /> Cargando...
              </div>
            ) : outOfOfficeRanges.length === 0 ? (
              <div className="text-center py-16 text-brown-mid">
                <PlaneTakeoff size={48} className="mx-auto mb-3 opacity-50" />
                <p className="text-lg">{t('admin.noOutOfOffice')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {outOfOfficeRanges.map(range => (
                  <div key={range.id} className="bg-cream-light rounded-2xl border border-rose p-5 flex items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-rose-light text-wine rounded-xl p-2.5 flex-shrink-0"><PlaneTakeoff size={18} /></div>
                      <div className="min-w-0">
                        <p className="font-bold text-brown-dark">{range.startDate} → {range.endDate}</p>
                        <p className="text-brown-mid text-sm truncate">{range.reason}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteOutOfOffice(range)} className="flex items-center gap-1.5 text-sm text-burgundy transition-colors bg-rose-light hover:bg-rose px-3 py-2 rounded-xl flex-shrink-0">
                      <Trash2 size={14} /> {t('admin.delete')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          tone={confirmDialog.tone}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  )
}
