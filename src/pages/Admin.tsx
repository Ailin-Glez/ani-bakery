import { useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProducts } from '../context/ProductContext'
import { useReviews } from '../context/ReviewContext'
import { useSales } from '../context/SalesContext'
import { exportSalesToExcel } from '../lib/exportSales'
import type { Product, SaleStatus } from '../types'
import { PlusCircle, Pencil, Trash2, X, LogOut, Eye, EyeOff, Star, Check, Ban, ImagePlus, Loader2, Download, DollarSign, Receipt, CalendarDays } from 'lucide-react'

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string

const EMPTY_PRODUCT: Omit<Product, 'id'> = {
  name: '', description: '', nameEn: '', descriptionEn: '', price: 0, image: '', category: '', available: true,
}

interface SaleFormData {
  customerName: string
  phone: string
  productName: string
  quantity: number
  unitPrice: number
  date: string
  notes: string
  status: SaleStatus
}

const EMPTY_SALE: SaleFormData = {
  customerName: '', phone: '', productName: '', quantity: 1, unitPrice: 0, date: '', notes: '', status: 'pending',
}

type Tab = 'products' | 'sales' | 'reviews'
type ReviewTab = 'pending' | 'approved'
type SalesFilter = 'all' | SaleStatus

export default function Admin() {
  const { t, i18n } = useTranslation()
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin-authed') === '1')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('products')
  const [reviewTab, setReviewTab] = useState<ReviewTab>('pending')
  const [editing, setEditing] = useState<Product | null>(null)
  const [adding, setAdding] = useState(false)
  const [formData, setFormData] = useState<Omit<Product, 'id'>>(EMPTY_PRODUCT)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [addingSale, setAddingSale] = useState(false)
  const [saleForm, setSaleForm] = useState<SaleFormData>(EMPTY_SALE)
  const [salesFilter, setSalesFilter] = useState<SalesFilter>('all')

  const { products, loading: productsLoading, addProduct, updateProduct, deleteProduct } = useProducts()
  const { pendingReviews, approvedReviews, loading: reviewsLoading, approveReview, rejectReview, deleteReview } = useReviews()
  const { sales, loading: salesLoading, addSale, updateSaleStatus, deleteSale } = useSales()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) { sessionStorage.setItem('admin-authed', '1'); setAuthed(true); setError('') }
    else setError(t('admin.wrongPassword'))
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    setFormData({ name: product.name, description: product.description, nameEn: product.nameEn ?? '', descriptionEn: product.descriptionEn ?? '', price: product.price, image: product.image, category: product.category, available: product.available })
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
  const openAddSale = () => { setAddingSale(true); setSaleForm(EMPTY_SALE) }
  const closeSaleModal = () => { setAddingSale(false); setSaleForm(EMPTY_SALE) }

  const handleSaleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value
    const matched = products.find(p => p.name === name)
    setSaleForm(prev => ({ ...prev, productName: name, unitPrice: matched ? matched.price : prev.unitPrice }))
  }

  const handleSaleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setSaleForm(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'unitPrice' ? Number(value) : value,
    }))
  }

  const handleSaleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    await addSale({
      customerName: saleForm.customerName,
      phone: saleForm.phone,
      productName: saleForm.productName,
      quantity: saleForm.quantity,
      unitPrice: saleForm.unitPrice,
      total: saleForm.unitPrice * saleForm.quantity,
      date: saleForm.date,
      notes: saleForm.notes,
      status: saleForm.status,
      source: 'manual',
    })
    closeSaleModal()
  }

  const filteredSales = useMemo(
    () => salesFilter === 'all' ? sales : sales.filter(s => s.status === salesFilter),
    [sales, salesFilter]
  )

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

  const statusBadgeClass: Record<SaleStatus, string> = {
    pending: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-rose-light text-wine',
  }

  // ── Login ──
  if (!authed) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="bg-cream-light rounded-3xl shadow-xl p-10 w-full max-w-sm text-center">
          <img src="/ana-logo.jpeg" alt="Ani's Artisan Bakery" className="w-24 h-24 rounded-full object-cover mx-auto mb-4 border-4 border-rose" />
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
          <img src="/ana-logo.jpeg" alt="Ani's Artisan Bakery" className="h-10 w-10 rounded-full object-cover" />
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
          {(['products', 'sales', 'reviews'] as Tab[]).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
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
                      <button onClick={() => { if (confirm(`${t('admin.delete')} "${product.name}"?`)) deleteProduct(product.id) }} className="flex items-center gap-1.5 text-sm text-wine transition-colors bg-rose-light hover:bg-rose px-3 py-2 rounded-xl">
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
                <div className="bg-green-100 text-green-700 rounded-xl p-2.5"><DollarSign size={20} /></div>
                <div>
                  <p className="text-xs text-brown-mid">{t('admin.salesTotalRevenue')}</p>
                  <p className="text-xl font-bold text-brown-dark">${salesSummary.totalRevenue.toFixed(2)}</p>
                </div>
              </div>
              <div className="bg-cream-light rounded-2xl border border-rose p-5 flex items-center gap-3">
                <div className="bg-rose-light text-wine rounded-xl p-2.5"><Receipt size={20} /></div>
                <div>
                  <p className="text-xs text-brown-mid">{t('admin.salesTotalOrders')}</p>
                  <p className="text-xl font-bold text-brown-dark">{salesSummary.totalOrders}</p>
                </div>
              </div>
              <div className="bg-cream-light rounded-2xl border border-rose p-5 flex items-center gap-3">
                <div className="bg-amber-100 text-amber-700 rounded-xl p-2.5"><CalendarDays size={20} /></div>
                <div>
                  <p className="text-xs text-brown-mid">{t('admin.salesMonthRevenue')}</p>
                  <p className="text-xl font-bold text-brown-dark">${salesSummary.monthRevenue.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex gap-2 flex-wrap">
                {(['all', 'pending', 'completed', 'cancelled'] as SalesFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setSalesFilter(f)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                      salesFilter === f ? 'bg-brown-dark text-cream-light' : 'bg-rose-light text-brown-mid hover:bg-rose'
                    }`}
                  >
                    {t(`admin.salesStatus${f.charAt(0).toUpperCase() + f.slice(1)}`)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => exportSalesToExcel(filteredSales, i18n.language === 'en')}
                  disabled={filteredSales.length === 0}
                  className="btn-secondary flex items-center gap-2 py-2.5 px-5 text-sm disabled:opacity-50"
                >
                  <Download size={16} /> {t('admin.downloadExcel')}
                </button>
                <button onClick={openAddSale} className="btn-primary flex items-center gap-2 py-2.5 px-5 text-sm">
                  <PlusCircle size={18} /> {t('admin.addSale')}
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
                        name="productName"
                        value={products.some(p => p.name === saleForm.productName) ? saleForm.productName : (saleForm.productName ? '__other__' : '')}
                        onChange={handleSaleProductChange}
                        required
                        className={inputClass}
                      >
                        <option value="">{t('orders.productPlaceholder')}</option>
                        {products.map(p => (
                          <option key={p.id} value={p.name}>{p.name} — ${p.price}</option>
                        ))}
                        <option value="__other__">{t('admin.fieldProductOther')}</option>
                      </select>
                      {!products.some(p => p.name === saleForm.productName) && saleForm.productName !== '' && (
                        <input
                          name="productName"
                          value={saleForm.productName === '__other__' ? '' : saleForm.productName}
                          onChange={handleSaleFieldChange}
                          placeholder={t('admin.fieldProduct')}
                          className={`${inputClass} mt-2`}
                        />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldQuantity')} *</label>
                        <input type="number" name="quantity" value={saleForm.quantity} onChange={handleSaleFieldChange} required min={1} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldUnitPrice')} *</label>
                        <input type="number" name="unitPrice" value={saleForm.unitPrice} onChange={handleSaleFieldChange} required min={0} step={0.5} className={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldDate')} *</label>
                        <input type="date" name="date" value={saleForm.date} onChange={handleSaleFieldChange} required className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldStatus')}</label>
                        <select name="status" value={saleForm.status} onChange={handleSaleFieldChange} className={inputClass}>
                          <option value="pending">{t('admin.salesStatusPending')}</option>
                          <option value="completed">{t('admin.salesStatusCompleted')}</option>
                          <option value="cancelled">{t('admin.salesStatusCancelled')}</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-brown-dark mb-1 uppercase tracking-wide">{t('admin.fieldNotes')}</label>
                      <textarea name="notes" value={saleForm.notes} onChange={handleSaleFieldChange} rows={2} className={`${inputClass} resize-none`} />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="submit" className="btn-primary flex-1 text-center text-sm py-3">{t('admin.addSale')}</button>
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
                {filteredSales.map(sale => (
                  <div key={sale.id} className="bg-cream-light rounded-2xl border border-rose p-5 flex flex-col sm:flex-row gap-4 sm:items-center shadow-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-brown-dark">{sale.customerName}</h3>
                          <p className="text-xs text-wine font-medium">{sale.productName} × {sale.quantity}</p>
                        </div>
                        <span className="text-lg font-bold text-wine flex-shrink-0">${sale.total.toFixed(2)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-xs text-brown-mid">{sale.date}</span>
                        {sale.phone && <span className="text-xs text-brown-mid">· {sale.phone}</span>}
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sale.source === 'web' ? 'bg-blue-100 text-blue-700' : 'bg-beige-light text-brown-mid'}`}>
                          {sale.source === 'web' ? t('admin.originWeb') : t('admin.originManual')}
                        </span>
                      </div>
                      {sale.notes && <p className="text-brown-mid text-xs mt-1.5 italic">"{sale.notes}"</p>}
                    </div>
                    <div className="flex sm:flex-col gap-2 flex-shrink-0">
                      <select
                        value={sale.status}
                        onChange={e => updateSaleStatus(sale.id, e.target.value as SaleStatus)}
                        className={`text-xs font-semibold px-3 py-2 rounded-xl border-0 cursor-pointer ${statusBadgeClass[sale.status]}`}
                      >
                        <option value="pending">{t('admin.salesStatusPending')}</option>
                        <option value="completed">{t('admin.salesStatusCompleted')}</option>
                        <option value="cancelled">{t('admin.salesStatusCancelled')}</option>
                      </select>
                      <button onClick={() => { if (confirm(`${t('admin.delete')}?`)) deleteSale(sale.id) }} className="flex items-center gap-1.5 text-sm text-wine transition-colors bg-rose-light hover:bg-rose px-3 py-2 rounded-xl">
                        <Trash2 size={14} /> {t('admin.delete')}
                      </button>
                    </div>
                  </div>
                ))}
                {filteredSales.length === 0 && (
                  <div className="text-center py-20 text-brown-mid">
                    <p className="text-6xl mb-4">🧾</p>
                    <p className="text-xl mb-4">{t('admin.noSales')}</p>
                    <button onClick={openAddSale} className="btn-primary">{t('admin.addSale')}</button>
                  </div>
                )}
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
                  onClick={() => setReviewTab(rt)}
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
                      <button onClick={() => { if (confirm(t('admin.deleteReview') + '?')) deleteReview(review.id) }} className="text-wine/50 hover:text-wine flex-shrink-0 p-1">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
