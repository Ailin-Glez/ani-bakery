import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useProducts } from '../context/ProductContext'
import { useSales } from '../context/SalesContext'
import { buildWhatsAppOrderLink, buildOrderMessage, isOrderDateValid } from '../config/business'

interface FormData {
  name: string
  phone: string
  product: string
  quantity: number
  date: string
  notes: string
}

const EMPTY: FormData = { name: '', phone: '', product: '', quantity: 1, date: '', notes: '' }

export default function Orders() {
  const { t, i18n } = useTranslation()
  const { products } = useProducts()
  const { addSale } = useSales()
  const [form, setForm] = useState<FormData>(EMPTY)
  const [sent, setSent] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const availableProducts = products.filter(p => p.available)

  const validateDate = (value: string) => {
    const input = dateInputRef.current
    if (!input) return
    input.setCustomValidity(value && !isOrderDateValid(value) ? t('orders.dateError') : '')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name === 'date') {
      validateDate(value)
      e.target.reportValidity()
    }
    setForm(prev => ({ ...prev, [name]: name === 'quantity' ? Number(value) : value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isOrderDateValid(form.date)) {
      dateInputRef.current?.reportValidity()
      return
    }
    const isEn = i18n.language === 'en'
    const message = buildOrderMessage(form, isEn)
    window.open(buildWhatsAppOrderLink(message), '_blank')
    const matchedProduct = products.find(p => p.name === form.product)
    addSale({
      customerName: form.name,
      phone: form.phone,
      productName: form.product,
      quantity: form.quantity,
      unitPrice: matchedProduct?.price ?? 0,
      total: (matchedProduct?.price ?? 0) * form.quantity,
      date: form.date,
      notes: form.notes,
      status: 'pending',
      source: 'web',
    })
    setSent(true)
    setTimeout(() => { setSent(false); setForm(EMPTY) }, 4000)
  }

  const inputClass = 'w-full bg-cream border border-rose rounded-xl px-4 py-3 text-brown-dark placeholder-brown-mid/40 focus:outline-none focus:border-wine focus:ring-1 focus:ring-wine/30 transition-colors'

  return (
    <section id="encargos" className="py-20 px-4 bg-rose-light">
      <div className="max-w-2xl mx-auto">
        <h2 className="section-title">{t('orders.title')}</h2>
        <p className="section-subtitle">{t('orders.subtitle')}</p>

        <div className="bg-cream-light rounded-3xl shadow-lg p-8">
          {sent ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🥳</div>
              <h3 className="text-2xl font-bold text-brown-dark mb-2">{t('orders.successTitle')}</h3>
              <p className="text-brown-mid">{t('orders.successText')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-brown-dark mb-1">{t('orders.name')} *</label>
                  <input name="name" value={form.name} onChange={handleChange} required placeholder={t('orders.namePlaceholder')} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-brown-dark mb-1">{t('orders.phone')} *</label>
                  <input name="phone" value={form.phone} onChange={handleChange} required placeholder={t('orders.phonePlaceholder')} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-brown-dark mb-1">{t('orders.product')} *</label>
                <select name="product" value={form.product} onChange={handleChange} required className={inputClass}>
                  <option value="">{t('orders.productPlaceholder')}</option>
                  {availableProducts.map(p => (
                    <option key={p.id} value={p.name}>{p.name} — ${p.price}</option>
                  ))}
                  <option value="Otro">{t('orders.productOther')}</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-brown-dark mb-1">{t('orders.quantity')} *</label>
                  <input type="number" name="quantity" value={form.quantity} onChange={handleChange} required min={1} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-brown-dark mb-1">{t('orders.date')} *</label>
                  <input ref={dateInputRef} type="date" name="date" value={form.date} onChange={handleChange} required className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-brown-dark mb-1">{t('orders.notes')}</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} placeholder={t('orders.notesPlaceholder')} rows={3} className={`${inputClass} resize-none`} />
              </div>

              <button type="submit" className="btn-primary text-center text-lg py-4 w-full">
                {t('orders.submit')}
              </button>
              <p className="text-center text-sm text-brown-mid">{t('orders.note')}</p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
