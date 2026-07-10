import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ShoppingBag, ChevronRight, ChevronLeft, Send, Plus, Minus, Trash2, Mail, Loader2 } from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useSales } from '../context/SalesContext'
import { useOutOfOffice } from '../context/OutOfOfficeContext'
import { business, buildWhatsAppOrderLink, buildOrderMessage, buildOrderEmailBody, sendOrderEmail, isOrderDateValid, isValidUSPhone, isValidEmail, formatUSPhoneInput, getBlockedRange } from '../config/business'
import type { ContactMethod } from '../types'

interface CartItem {
  product: string
  productEn: string
  quantity: number
  unitPrice: number
}

interface DetailsForm {
  name: string
  phone: string
  email: string
  date: string
  notes: string
}

const EMPTY_DETAILS: DetailsForm = { name: '', phone: '', email: '', date: '', notes: '' }

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
      <img src={business.logo} alt="Ani" className="w-8 h-8 rounded-full object-cover flex-shrink-0 mb-0.5" />
      <div className="bg-cream-light rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm max-w-[85%] text-brown-dark text-sm leading-relaxed">
        {children}
      </div>
    </div>
  )
}

export default function OrderChat({ open, onClose, initialProduct }: Props) {
  const { t, i18n } = useTranslation()
  const { products } = useProducts()
  const { addSale } = useSales()
  const { ranges: outOfOfficeRanges } = useOutOfOffice()
  const [step, setStep] = useState<Step>('product')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customName, setCustomName] = useState('')
  const [addingCustom, setAddingCustom] = useState(false)
  const [details, setDetails] = useState<DetailsForm>(EMPTY_DETAILS)
  const [contactMethod, setContactMethod] = useState<ContactMethod>('phone')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const phoneInputRef = useRef<HTMLInputElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)

  const isEn = i18n.language === 'en'
  const availableProducts = products.filter(p => p.available)

  useEffect(() => {
    if (open && initialProduct) {
      const matched = products.find(p => p.name === initialProduct)
      setCart([{
        product: initialProduct,
        productEn: matched?.nameEn || initialProduct,
        quantity: 1,
        unitPrice: matched?.price ?? 0,
      }])
      setStep('product')
    }
  }, [open, initialProduct, products])

  const reset = () => { setCart([]); setDetails(EMPTY_DETAILS); setContactMethod('phone'); setCustomName(''); setAddingCustom(false); setStep('product'); setSent(false); setSending(false); setSendError(false) }
  const close = () => { onClose(); setTimeout(reset, 400) }

  const addToCart = (p: { name: string; nameEn?: string; price: number }) => {
    setCart(prev => {
      const idx = prev.findIndex(item => item.product === p.name)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
        return next
      }
      return [...prev, { product: p.name, productEn: p.nameEn || p.name, quantity: 1, unitPrice: p.price }]
    })
  }

  const addCustomItem = () => {
    if (!customName.trim()) return
    setCart(prev => [...prev, { product: customName.trim(), productEn: customName.trim(), quantity: 1, unitPrice: 0 }])
    setCustomName('')
    setAddingCustom(false)
  }

  const changeQuantity = (product: string, delta: number) => {
    setCart(prev => prev
      .map(item => item.product === product ? { ...item, quantity: item.quantity + delta } : item)
      .filter(item => item.quantity > 0))
  }

  const removeFromCart = (product: string) => {
    setCart(prev => prev.filter(item => item.product !== product))
  }

  const getDateValidityMessage = (value: string) => {
    if (!value) return ''
    if (!isOrderDateValid(value)) return t('orders.dateError')
    const blocked = getBlockedRange(value, outOfOfficeRanges)
    if (blocked) return `${t('orders.dateBlockedPrefix')} ${blocked.reason}`
    return ''
  }

  const handleDetailsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name === 'date') {
      dateInputRef.current?.setCustomValidity(getDateValidityMessage(value))
      e.target.reportValidity()
    }
    if (name === 'name') nameInputRef.current?.setCustomValidity('')
    if (name === 'email') emailInputRef.current?.setCustomValidity('')
    if (name === 'phone') {
      phoneInputRef.current?.setCustomValidity('')
      setDetails(prev => ({ ...prev, phone: formatUSPhoneInput(value) }))
      return
    }
    setDetails(prev => ({ ...prev, [name]: value }))
  }

  const goToConfirm = () => {
    if (!details.name.trim()) {
      nameInputRef.current?.setCustomValidity(t('orders.nameError'))
      nameInputRef.current?.reportValidity()
      return
    }
    const dateMessage = getDateValidityMessage(details.date)
    if (dateMessage) {
      dateInputRef.current?.setCustomValidity(dateMessage)
      dateInputRef.current?.reportValidity()
      return
    }
    if (contactMethod === 'phone' && !isValidUSPhone(details.phone)) {
      phoneInputRef.current?.setCustomValidity(t('orders.phoneError'))
      phoneInputRef.current?.reportValidity()
      return
    }
    if (contactMethod === 'email' && !isValidEmail(details.email)) {
      emailInputRef.current?.setCustomValidity(t('orders.emailError'))
      emailInputRef.current?.reportValidity()
      return
    }
    setStep('confirm')
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  const today = new Date().toISOString().slice(0, 10)
  const upcomingOutOfOffice = outOfOfficeRanges.filter(r => r.endDate >= today).slice(0, 2)

  const recordSale = () => {
    const orderId = crypto.randomUUID()
    cart.forEach(item => {
      addSale({
        orderId,
        customerName: details.name,
        phone: contactMethod === 'phone' ? details.phone : '',
        email: contactMethod === 'email' ? details.email : '',
        contactMethod,
        productName: item.product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.unitPrice * item.quantity,
        date: details.date,
        notes: details.notes,
        status: 'pending_confirmation',
        source: 'web',
        paid: false,
        language: isEn ? 'en' : 'es',
      })
    })
  }

  const submitOrder = async () => {
    const items = cart.map(item => ({
      product: isEn && item.productEn ? item.productEn : item.product,
      quantity: item.quantity,
    }))
    const contact = { method: contactMethod, value: contactMethod === 'phone' ? details.phone : details.email }

    if (contactMethod === 'phone') {
      const message = buildOrderMessage({ name: details.name, contact, items, date: details.date, notes: details.notes }, isEn)
      window.open(buildWhatsAppOrderLink(message), '_blank')
      recordSale()
      setSent(true)
      return
    }

    setSending(true)
    setSendError(false)
    const body = buildOrderEmailBody({ name: details.name, contact, items, date: details.date, notes: details.notes }, isEn)
    const subject = isEn ? `Order from ${details.name}` : `Encargo de ${details.name}`
    const ok = await sendOrderEmail({ subject, message: body, replyTo: details.email, fromName: details.name })
    setSending(false)
    if (!ok) {
      setSendError(true)
      return
    }
    recordSale()
    setSent(true)
  }

  const inputClass = 'w-full bg-cream border border-rose rounded-xl px-4 py-2.5 text-brown-dark placeholder-brown-mid/40 focus:outline-none focus:border-wine focus:ring-1 focus:ring-wine/30 transition-colors text-sm'

  const canGoNext = step === 'product' ? cart.length > 0 : true

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-brown-dark/40 z-50 backdrop-blur-sm" onClick={close} />

      {/* Panel */}
      <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 w-full sm:w-[400px] h-full sm:h-auto sm:max-h-[90dvh] flex flex-col rounded-none sm:rounded-3xl overflow-hidden shadow-2xl animate-[slideUp_0.35s_cubic-bezier(.32,.72,0,1)]">

        {/* Chat header */}
        <div className="bg-wine px-5 py-4 flex items-center gap-3 flex-shrink-0">
          <div className="relative">
            <img src={business.logo} alt="Ani's Artisan Bakery" className="w-11 h-11 rounded-full object-cover border-2 border-white/30" />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-wine" />
          </div>
          <div className="flex-1">
            <p className="text-cream-light font-bold text-base leading-tight">Ani's Artisan Bakery</p>
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
              <p className="text-brown-mid text-sm">{t(contactMethod === 'phone' ? 'orders.successText' : 'orders.successTextEmail')}</p>
              <button onClick={close} className="btn-primary mt-2 text-sm py-2.5 px-6">
                {isEn ? 'Close' : 'Cerrar'}
              </button>
            </div>
          ) : step === 'product' ? (
            <>
              <ChatBubble>
                {isEn ? '👋 Hi! What would you like to order? Add as many products as you need' : '👋 ¡Hola! ¿Qué te gustaría encargar? Agrega todos los productos que necesites'}
              </ChatBubble>

              <div className="flex flex-col gap-2 mt-2">
                {availableProducts.map(p => {
                  const inCart = cart.find(item => item.product === p.name)
                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className={`text-left px-4 py-3 rounded-2xl border-2 transition-all text-sm font-medium flex items-center justify-between gap-2 ${
                        inCart
                          ? 'border-wine bg-wine text-cream-light'
                          : 'border-rose bg-cream-light text-brown-dark hover:border-wine/60'
                      }`}
                    >
                      <span>
                        <span className="font-semibold">{isEn && p.nameEn ? p.nameEn : p.name}</span>
                        <span className="ml-2 font-normal opacity-70">${p.price}</span>
                      </span>
                      {inCart
                        ? <span className="text-xs font-bold opacity-90">{inCart.quantity} ✓</span>
                        : <ChevronRight size={16} className="flex-shrink-0 opacity-60" />}
                    </button>
                  )
                })}

                {addingCustom ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={customName}
                      onChange={e => setCustomName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addCustomItem() }}
                      placeholder={isEn ? 'What would you like to order?' : '¿Qué quieres encargar?'}
                      className={inputClass}
                    />
                    <button onClick={addCustomItem} className="btn-primary text-sm px-4 flex-shrink-0">
                      {isEn ? 'Add' : 'Agregar'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingCustom(true)}
                    className="text-left px-4 py-3 rounded-2xl border-2 border-dashed border-rose bg-cream-light text-brown-mid hover:border-wine/60 transition-all text-sm"
                  >
                    {t('orders.productOther')}
                  </button>
                )}
              </div>

              {cart.length > 0 && (
                <div className="bg-gold-dark text-brown-dark rounded-2xl p-4 shadow-lg flex flex-col gap-2.5 mt-2 border-2 border-gold-deep">
                  <div className="flex items-center gap-1.5">
                    <ShoppingBag size={15} />
                    <p className="text-xs font-bold uppercase tracking-wide">{t('orders.yourOrder')}</p>
                  </div>
                  {cart.map(item => (
                    <div key={item.product} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex-1 truncate font-semibold">{isEn ? item.productEn : item.product}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => changeQuantity(item.product, -1)} className="w-6 h-6 flex items-center justify-center rounded-full bg-brown-dark/10 hover:bg-brown-dark/20">
                          <Minus size={12} />
                        </button>
                        <span className="w-5 text-center font-bold">{item.quantity}</span>
                        <button onClick={() => changeQuantity(item.product, 1)} className="w-6 h-6 flex items-center justify-center rounded-full bg-brown-dark/10 hover:bg-brown-dark/20">
                          <Plus size={12} />
                        </button>
                        <button onClick={() => removeFromCart(item.product)} className="ml-1 text-brown-dark/60 hover:text-brown-dark">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : step === 'details' ? (
            <>
              <ChatBubble>
                {isEn
                  ? `Great choice! 🎉 Now just a few details…`
                  : `¡Excelente elección! 🎉 Ahora solo algunos detalles…`}
              </ChatBubble>

              <div className="bg-cream-light rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                <div>
                  <label className="block text-xs font-semibold text-brown-dark mb-1">{t('orders.name')} *</label>
                  <input ref={nameInputRef} name="name" value={details.name} onChange={handleDetailsChange} required placeholder={t('orders.namePlaceholder')} className={inputClass} />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brown-dark mb-1">{t('orders.contactMethodLabel')} *</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setContactMethod('phone')}
                      className={`flex-1 text-xs font-semibold py-2 rounded-xl border-2 transition-colors ${
                        contactMethod === 'phone' ? 'border-wine bg-wine text-cream-light' : 'border-rose bg-cream text-brown-mid'
                      }`}
                    >
                      {t('orders.contactMethodPhone')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setContactMethod('email')}
                      className={`flex-1 text-xs font-semibold py-2 rounded-xl border-2 transition-colors ${
                        contactMethod === 'email' ? 'border-wine bg-wine text-cream-light' : 'border-rose bg-cream text-brown-mid'
                      }`}
                    >
                      {t('orders.contactMethodEmail')}
                    </button>
                  </div>
                </div>

                {contactMethod === 'phone' ? (
                  <div>
                    <label className="block text-xs font-semibold text-brown-dark mb-1">{t('orders.phone')} *</label>
                    <input ref={phoneInputRef} name="phone" value={details.phone} onChange={handleDetailsChange} required placeholder={t('orders.phonePlaceholder')} className={inputClass} />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-brown-dark mb-1">{t('orders.email')} *</label>
                    <input ref={emailInputRef} type="email" name="email" value={details.email} onChange={handleDetailsChange} required placeholder={t('orders.emailPlaceholder')} className={inputClass} />
                    <p className="text-xs font-semibold text-burgundy mt-1">{t('orders.emailPriorityNote')}</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-brown-dark mb-1">{t('orders.date')} *</label>
                  <input ref={dateInputRef} type="date" name="date" value={details.date} onChange={handleDetailsChange} required className={inputClass} />
                  {upcomingOutOfOffice.length > 0 && (
                    <div className="text-xs font-semibold text-burgundy mt-1.5">
                      <p>{t('orders.upcomingOutOfOffice')}:</p>
                      {upcomingOutOfOffice.map(range => (
                        <p key={range.id} className="font-normal">{range.startDate} → {range.endDate} — {range.reason}</p>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brown-dark mb-1">{t('orders.notes')}</label>
                  <textarea name="notes" value={details.notes} onChange={handleDetailsChange} placeholder={t('orders.notesPlaceholder')} rows={2} className={`${inputClass} resize-none`} />
                </div>
              </div>
            </>
          ) : (
            <>
              <ChatBubble>
                {isEn ? '✅ Here\'s your order summary:' : '✅ Así queda tu encargo:'}
              </ChatBubble>

              <div className="bg-cream-light rounded-2xl p-4 shadow-sm text-sm flex flex-col gap-2">
                <div className="flex flex-col gap-1.5 pb-2 border-b border-rose">
                  {cart.map(item => (
                    <div key={item.product} className="flex justify-between gap-2">
                      <span className="text-brown-dark">{(isEn ? item.productEn : item.product)} × {item.quantity}</span>
                      {item.unitPrice > 0 && <span className="text-brown-mid flex-shrink-0">${(item.unitPrice * item.quantity).toFixed(2)}</span>}
                    </div>
                  ))}
                  {cartTotal > 0 && (
                    <div className="flex justify-between gap-2 font-bold text-brown-dark pt-1">
                      <span>{t('admin.total')}</span>
                      <span>${cartTotal.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                {[
                  { icon: '📅', label: t('orders.date'), value: details.date },
                  { icon: '👤', label: t('orders.name'), value: details.name },
                  contactMethod === 'phone'
                    ? { icon: '📱', label: t('orders.phone'), value: details.phone }
                    : { icon: '📧', label: t('orders.email'), value: details.email },
                  ...(details.notes ? [{ icon: '📝', label: t('orders.notes'), value: details.notes }] : []),
                ].map(row => (
                  <div key={row.label} className="flex gap-2">
                    <span>{row.icon}</span>
                    <span className="text-brown-mid">{row.label}:</span>
                    <span className="font-semibold text-brown-dark">{row.value}</span>
                  </div>
                ))}
              </div>

              <ChatBubble delay={200}>
                {contactMethod === 'phone'
                  ? (isEn ? 'I\'ll send you a WhatsApp to confirm! 💬' : '¡Te envío un WhatsApp para confirmar! 💬')
                  : (isEn ? 'I\'ll reply to your email to confirm — replies may take a bit longer than WhatsApp! 📧' : '¡Te respondo al email para confirmar — puede tardar un poco más que por WhatsApp! 📧')}
              </ChatBubble>
            </>
          )}
        </div>

        {/* Footer nav */}
        {!sent && (
          <div className="bg-cream-light border-t border-rose px-4 py-3 flex flex-col gap-2 flex-shrink-0">
            {sendError && <p className="text-xs font-semibold text-burgundy">{t('orders.emailSendError')}</p>}
            <div className="flex gap-3">
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
                onClick={() => step === 'product' ? setStep('details') : goToConfirm()}
                disabled={!canGoNext}
                className="flex-1 btn-primary text-sm py-2.5 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isEn ? 'Continue' : 'Continuar'} <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={submitOrder}
                disabled={sending}
                className={`flex-1 text-white font-bold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  contactMethod === 'phone' ? 'bg-[#25D366] hover:bg-[#1ebe5d]' : 'bg-wine hover:bg-wine-dark'
                }`}
              >
                {sending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : contactMethod === 'phone' ? <Send size={16} /> : <Mail size={16} />}
                {sending ? (isEn ? 'Sending…' : 'Enviando…') : contactMethod === 'phone' ? t('orders.submit') : t('orders.submitEmail')}
              </button>
            )}
            </div>
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
