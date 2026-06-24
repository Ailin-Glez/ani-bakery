import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ShoppingBag, ChevronRight, ChevronLeft, Send } from 'lucide-react'
import { useProducts } from '../context/ProductContext'

interface FormData {
  name: string
  phone: string
  product: string
  quantity: number
  date: string
  notes: string
}

const EMPTY: FormData = { name: '', phone: '', product: '', quantity: 1, date: '', notes: '' }

const STEPS = ['product', 'details', 'confirm'] as const
type Step = typeof STEPS[number]

interface Props {
  open: boolean
  onClose: () => void
  initialProduct?: string
}

function ChatBubble({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [visible, setVisible] = useState(delay === 0)
  useEffect(() => {
    if (delay > 0) {
      const t = setTimeout(() => setVisible(true), delay)
      return () => clearTimeout(t)
    }
  }, [delay])
  if (!visible) return null
  return (
    <div className="flex items-end gap-2 animate-[fadeSlideUp_0.3s_ease]">
      <img src="/ana-logo.jpeg" alt="Ani" className="w-8 h-8 rounded-full object-cover flex-shrink-0 mb-0.5" />
      <div className="bg-cream-light rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm max-w-[85%] text-brown-dark text-sm leading-relaxed">
        {children}
      </div>
    </div>
  )
}

export default function OrderChat({ open, onClose, initialProduct }: Props) {
  const { t, i18n } = useTranslation()
  const { products } = useProducts()
  const [step, setStep] = useState<Step>('product')
  const [form, setForm] = useState<FormData>(EMPTY)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (open && initialProduct) {
      setForm(prev => ({ ...prev, product: initialProduct }))
      setStep('details')
    }
  }, [open, initialProduct])

  const availableProducts = products.filter(p => p.available)
  const isEn = i18n.language === 'en'

  const reset = () => { setForm(EMPTY); setStep('product'); setSent(false) }
  const close = () => { onClose(); setTimeout(reset, 400) }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: name === 'quantity' ? Number(value) : value }))
  }

  const sendWhatsApp = () => {
    const message = encodeURIComponent(
      isEn
        ? `Hi Ani! I'd like to place an order 🎉\n\n👤 Name: ${form.name}\n📱 Phone: ${form.phone}\n🍞 Product: ${form.product}\n🔢 Quantity: ${form.quantity}\n📅 Desired date: ${form.date}\n${form.notes ? `📝 Notes: ${form.notes}\n` : ''}\nThank you!`
        : `¡Hola Ani! Quiero hacer un encargo 🎉\n\n👤 Nombre: ${form.name}\n📱 Teléfono: ${form.phone}\n🍞 Producto: ${form.product}\n🔢 Cantidad: ${form.quantity}\n📅 Fecha deseada: ${form.date}\n${form.notes ? `📝 Notas: ${form.notes}\n` : ''}\n¡Gracias!`
    )
    window.open(`https://wa.me/8643465333?text=${message}`, '_blank')
    setSent(true)
  }

  const inputClass = 'w-full bg-cream border border-rose rounded-xl px-4 py-2.5 text-brown-dark placeholder-brown-mid/40 focus:outline-none focus:border-wine focus:ring-1 focus:ring-wine/30 transition-colors text-sm'

  const canGoNext = step === 'product'
    ? !!form.product
    : step === 'details'
    ? !!form.name && !!form.phone && !!form.date && !!form.product
    : true

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-brown-dark/40 z-50 backdrop-blur-sm" onClick={close} />

      {/* Panel */}
      <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[400px] max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-[slideUp_0.35s_cubic-bezier(.32,.72,0,1)]">

        {/* Chat header */}
        <div className="bg-wine px-5 py-4 flex items-center gap-3 flex-shrink-0">
          <div className="relative">
            <img src="/ana-logo.jpeg" alt="Ani's Bakery" className="w-11 h-11 rounded-full object-cover border-2 border-white/30" />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-wine" />
          </div>
          <div className="flex-1">
            <p className="text-cream-light font-bold text-base leading-tight">Ani's Bakery</p>
            <p className="text-white/70 text-xs">{isEn ? 'Usually replies in minutes' : 'Responde en minutos'}</p>
          </div>
          <button onClick={close} className="text-white/70 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {/* Step indicators */}
        <div className="bg-wine/90 px-5 pb-3 flex gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1 rounded-full flex-1 transition-all ${STEPS.indexOf(step) >= i ? 'bg-white' : 'bg-white/30'}`} />
          ))}
        </div>

        {/* Messages area */}
        <div className="bg-[#f0e6d8] flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4 min-h-0">

          {sent ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 py-10 text-center">
              <div className="text-6xl">🥳</div>
              <p className="font-bold text-brown-dark text-xl">{t('orders.successTitle')}</p>
              <p className="text-brown-mid text-sm">{t('orders.successText')}</p>
              <button onClick={close} className="btn-primary mt-2 text-sm py-2.5 px-6">
                {isEn ? 'Close' : 'Cerrar'}
              </button>
            </div>
          ) : step === 'product' ? (
            <>
              <ChatBubble>
                {isEn ? '👋 Hi! What would you like to order?' : '👋 ¡Hola! ¿Qué te gustaría encargar?'}
              </ChatBubble>
              <ChatBubble delay={300}>
                {isEn ? 'Choose a product or tell me what you need 🍞' : 'Elige un producto o cuéntame qué necesitas 🍞'}
              </ChatBubble>

              <div className="flex flex-col gap-2 mt-2">
                {availableProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setForm(prev => ({ ...prev, product: p.name }))}
                    className={`text-left px-4 py-3 rounded-2xl border-2 transition-all text-sm font-medium flex items-center justify-between gap-2 ${
                      form.product === p.name
                        ? 'border-wine bg-wine text-cream-light'
                        : 'border-rose bg-cream-light text-brown-dark hover:border-wine/60'
                    }`}
                  >
                    <span>
                      <span className="font-semibold">{isEn && (p as any).nameEn ? (p as any).nameEn : p.name}</span>
                      <span className="ml-2 font-normal opacity-70">${p.price}</span>
                    </span>
                    {form.product === p.name
                      ? <span className="text-xs font-bold opacity-90">✓</span>
                      : <ChevronRight size={16} className="flex-shrink-0 opacity-60" />}
                  </button>
                ))}
                <button
                  onClick={() => setForm(prev => ({ ...prev, product: 'Otro' }))}
                  className={`text-left px-4 py-3 rounded-2xl border-2 border-dashed transition-all text-sm ${
                    form.product === 'Otro'
                      ? 'border-wine bg-wine text-cream-light'
                      : 'border-rose bg-cream-light text-brown-mid hover:border-wine/60'
                  }`}
                >
                  {t('orders.productOther')}
                </button>
              </div>
            </>
          ) : step === 'details' ? (
            <>
              <ChatBubble>
                {isEn
                  ? `Great choice! 🎉 Now just a few details…`
                  : `¡Excelente elección! 🎉 Ahora solo algunos detalles…`}
              </ChatBubble>

              <div className="bg-cream-light rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                {form.product === 'Otro' && (
                  <div>
                    <label className="block text-xs font-semibold text-brown-dark mb-1">{t('orders.product')} *</label>
                    <input name="product" value={form.product === 'Otro' ? '' : form.product} onChange={e => setForm(prev => ({ ...prev, product: e.target.value }))} required placeholder={isEn ? 'What would you like to order?' : '¿Qué quieres encargar?'} className={inputClass} />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-brown-dark mb-1">{t('orders.name')} *</label>
                  <input name="name" value={form.name} onChange={handleChange} required placeholder={t('orders.namePlaceholder')} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brown-dark mb-1">{t('orders.phone')} *</label>
                  <input name="phone" value={form.phone} onChange={handleChange} required placeholder={t('orders.phonePlaceholder')} className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-brown-dark mb-1">{t('orders.quantity')} *</label>
                    <input type="number" name="quantity" value={form.quantity} onChange={handleChange} required min={1} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brown-dark mb-1">{t('orders.date')} *</label>
                    <input type="date" name="date" value={form.date} onChange={handleChange} required className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brown-dark mb-1">{t('orders.notes')}</label>
                  <textarea name="notes" value={form.notes} onChange={handleChange} placeholder={t('orders.notesPlaceholder')} rows={2} className={`${inputClass} resize-none`} />
                </div>
              </div>
            </>
          ) : (
            <>
              <ChatBubble>
                {isEn ? '✅ Here\'s your order summary:' : '✅ Así queda tu encargo:'}
              </ChatBubble>

              <div className="bg-cream-light rounded-2xl p-4 shadow-sm text-sm flex flex-col gap-2">
                {[
                  { icon: '🍞', label: t('orders.product'), value: form.product },
                  { icon: '🔢', label: t('orders.quantity'), value: form.quantity },
                  { icon: '📅', label: t('orders.date'), value: form.date },
                  { icon: '👤', label: t('orders.name'), value: form.name },
                  { icon: '📱', label: t('orders.phone'), value: form.phone },
                  ...(form.notes ? [{ icon: '📝', label: t('orders.notes'), value: form.notes }] : []),
                ].map(row => (
                  <div key={row.label} className="flex gap-2">
                    <span>{row.icon}</span>
                    <span className="text-brown-mid">{row.label}:</span>
                    <span className="font-semibold text-brown-dark">{row.value}</span>
                  </div>
                ))}
              </div>

              <ChatBubble delay={200}>
                {isEn
                  ? 'I\'ll send you a WhatsApp to confirm! 💬'
                  : '¡Te envío un WhatsApp para confirmar! 💬'}
              </ChatBubble>
            </>
          )}
        </div>

        {/* Footer nav */}
        {!sent && (
          <div className="bg-cream-light border-t border-rose px-4 py-3 flex gap-3 flex-shrink-0">
            {step !== 'product' && (
              <button
                onClick={() => setStep(step === 'confirm' ? 'details' : 'product')}
                className="flex items-center gap-1 text-sm text-brown-mid hover:text-brown-dark transition-colors px-3 py-2"
              >
                <ChevronLeft size={16} /> {isEn ? 'Back' : 'Atrás'}
              </button>
            )}
            {step !== 'confirm' ? (
              <button
                onClick={() => setStep(step === 'product' ? 'details' : 'confirm')}
                disabled={!canGoNext}
                className="flex-1 btn-primary text-sm py-2.5 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isEn ? 'Continue' : 'Continuar'} <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={sendWhatsApp}
                className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Send size={16} /> {t('orders.submit')}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export function FloatingOrderButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 200)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={`fixed bottom-16 right-6 z-40 transition-all duration-300 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0 pointer-events-none'}`}>
      {/* Pulse ring */}
      <span className="absolute inset-0 rounded-full bg-emerald-500/40 animate-ping" style={{ animationDuration: '2s' }} />
      <button
        onClick={onClick}
        className="relative flex items-center gap-2 bg-emerald-600 text-white font-bold px-5 py-3.5 rounded-full shadow-lg hover:shadow-xl hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all duration-200"
      >
        <ShoppingBag size={18} className="animate-[nudge_3s_ease-in-out_infinite]" />
        <span className="text-sm">{t('nav.cta')}</span>
      </button>
    </div>
  )
}
