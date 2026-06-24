import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '../lib/firebase'
import { useProducts } from '../context/ProductContext'
import { useReviews } from '../context/ReviewContext'
import type { Product } from '../types'
import { PlusCircle, Pencil, Trash2, X, LogOut, Eye, EyeOff, Star, Check, Ban, ImagePlus, Loader2 } from 'lucide-react'

const ADMIN_PASSWORD = 'anisbakery2025'

const EMPTY_PRODUCT: Omit<Product, 'id'> = {
  name: '', description: '', nameEn: '', descriptionEn: '', price: 0, image: '', category: '', available: true,
}

type Tab = 'products' | 'reviews'
type ReviewTab = 'pending' | 'approved'

export default function Admin() {
  const { t } = useTranslation()
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('products')
  const [reviewTab, setReviewTab] = useState<ReviewTab>('pending')
  const [editing, setEditing] = useState<Product | null>(null)
  const [adding, setAdding] = useState(false)
  const [formData, setFormData] = useState<Omit<Product, 'id'>>(EMPTY_PRODUCT)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { products, loading: productsLoading, addProduct, updateProduct, deleteProduct } = useProducts()
  const { pendingReviews, approvedReviews, loading: reviewsLoading, approveReview, rejectReview, deleteReview } = useReviews()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) { setAuthed(true); setError('') }
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadProgress(0)
    const storageRef = ref(storage, `products/${Date.now()}-${file.name}`)
    const task = uploadBytesResumable(storageRef, file)
    task.on(
      'state_changed',
      snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      () => setUploading(false),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        setFormData(prev => ({ ...prev, image: url }))
        setUploading(false)
      }
    )
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editing) await updateProduct(editing.id, formData)
    else await addProduct(formData)
    closeModal()
  }

  const inputClass = 'w-full bg-cream border border-rose rounded-xl px-4 py-2.5 text-brown-dark placeholder-brown-mid/40 focus:outline-none focus:border-wine focus:ring-1 focus:ring-wine/30 transition-colors text-sm'

  // ── Login ──
  if (!authed) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="bg-cream-light rounded-3xl shadow-xl p-10 w-full max-w-sm text-center">
          <img src="/ana-logo.jpeg" alt="Ani's Bakery" className="w-24 h-24 rounded-full object-cover mx-auto mb-4 border-4 border-rose" />
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
          <img src="/ana-logo.jpeg" alt="Ani's Bakery" className="h-10 w-10 rounded-full object-cover" />
          <div>
            <h1 className="font-bold text-brown-dark">{t('admin.title')}</h1>
            <p className="text-xs text-brown-mid">{t('admin.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="text-sm text-brown-mid hover:text-brown-dark">{t('admin.viewStore')}</a>
          <button onClick={() => setAuthed(false)} className="flex items-center gap-2 text-sm text-wine hover:text-brown-dark transition-colors">
            <LogOut size={16} /> {t('admin.logout')}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-rose bg-cream-light">
        <div className="max-w-5xl mx-auto px-6 flex">
          {(['products', 'reviews'] as Tab[]).map(tabKey => (
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
                            <span className="text-xs">{uploading ? `${uploadProgress}%` : t('admin.fieldImageUpload')}</span>
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
                          <div className="h-full bg-wine transition-all duration-300 rounded-full" style={{ width: `${uploadProgress}%` }} />
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
                  <div key={review.id} className="bg-cream-light rounded-2xl border-2 border-rose p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4 mb-3">
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
                    <p className="text-brown-mid italic mb-4">"{review.comment}"</p>
                    <div className="flex gap-3">
                      <button onClick={() => approveReview(review.id)} className="flex items-center gap-2 bg-green-100 hover:bg-green-200 text-green-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors">
                        <Check size={16} /> {t('admin.approve')}
                      </button>
                      <button onClick={() => rejectReview(review.id)} className="flex items-center gap-2 bg-rose-light hover:bg-rose text-wine font-semibold px-4 py-2 rounded-xl text-sm transition-colors">
                        <Ban size={16} /> {t('admin.reject')}
                      </button>
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
                  <div key={review.id} className="bg-cream-light rounded-2xl border border-rose p-6 shadow-sm flex gap-4 items-start">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-bold text-brown-dark">{review.name}</p>
                        <span className="text-xs text-brown-light">{review.date}</span>
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
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
