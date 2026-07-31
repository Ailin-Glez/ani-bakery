import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ShoppingBag, ChevronRight, ChevronLeft, CreditCard, Plus, Minus, Trash2, Loader2, MessageCircle, Calendar } from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useOutOfOffice } from '../context/OutOfOfficeContext'
import {
  business, createCheckoutSession, getMinOrderDate, getMaxOrderDate, getOrderLeadDays,
  getBlockedRange, getDeliveryFee, getTax, buildWhatsAppOrderLink, openWhatsAppLink,
  DELIVERY_FEE, TAX_PERCENT, BREAD_CATEGORY, MAX_BREAD_PER_ORDER, COOKIE_CATEGORY,
} from '../config/business'
import DatePicker from './DatePicker'
import type { DeliveryMethod } from '../types'

interface CartItem {
  productId: string
  product: string
  productEn: string
  quantity: number
  unitPrice: number
  maxQuantity?: number
  category: string
}

interface DetailsForm {
  date: string
  notes: string
}

const EMPTY_DETAILS: DetailsForm = { date: '', notes: '' }

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
  const { ranges: outOfOfficeRanges } = useOutOfOffice()
  const [step, setStep] = useState<Step>('product')
  const [cart, setCart] = useState<CartItem[]>([])
  const [details, setDetails] = useState<DetailsForm>(EMPTY_DETAILS)
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | ''>('')
  const [deliveryMethodError, setDeliveryMethodError] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(false)
  const [checkoutErrorMessage, setCheckoutErrorMessage] = useState('')
  const [dateError, setDateError] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)

  const isEn = i18n.language === 'en'
  const availableProducts = products.filter(p => p.available)
  const breadQuantityInCart = cart.filter(item => item.category === BREAD_CATEGORY).reduce((sum, item) => sum + item.quantity, 0)
  const hasCookies = cart.some(item => item.category === COOKIE_CATEGORY)

  useEffect(() => {
    if (open && initialProduct) {
      const matched = products.find(p => p.name === initialProduct)
      if (!matched) return
      setCart([{
        productId: matched.id,
        product: initialProduct,
        productEn: matched.nameEn || initialProduct,
        quantity: 1,
        unitPrice: matched.price,
        maxQuantity: matched.maxQuantity,
        category: matched.category,
      }])
      setStep('product')
    }
  }, [open, initialProduct, products])

  const reset = () => { setCart([]); setDetails(EMPTY_DETAILS); setDeliveryMethod(''); setDeliveryMethodError(false); setStep('product'); setSending(false); setSendError(false); setCheckoutErrorMessage(''); setDateError(''); setShowCalendar(false) }
  const close = () => { onClose(); setTimeout(reset, 400) }

  // The bread cap is shared across every bread item in the cart, so adding one more
  // unit of any bread product is blocked once the combined bread quantity hits the cap.
  const addToCart = (p: { id: string; name: string; nameEn?: string; price: number; maxQuantity?: number; category: string }) => {
    setCart(prev => {
      const idx = prev.findIndex(item => item.product === p.name)
      if (idx >= 0) {
        const current = prev[idx]
        if (current.maxQuantity != null && current.quantity >= current.maxQuantity) return prev
        if (current.category === BREAD_CATEGORY && breadQuantityInCart >= MAX_BREAD_PER_ORDER) return prev
        const next = [...prev]
        next[idx] = { ...current, quantity: current.quantity + 1 }
        return next
      }
      if (p.category === BREAD_CATEGORY && breadQuantityInCart >= MAX_BREAD_PER_ORDER) return prev
      return [...prev, { productId: p.id, product: p.name, productEn: p.nameEn || p.name, quantity: 1, unitPrice: p.price, maxQuantity: p.maxQuantity, category: p.category }]
    })
  }

  const changeQuantity = (product: string, delta: number) => {
    setCart(prev => prev
      .map(item => {
        if (item.product !== product) return item
        if (delta > 0 && item.category === BREAD_CATEGORY && breadQuantityInCart >= MAX_BREAD_PER_ORDER) return item
        const quantity = item.maxQuantity != null ? Math.min(item.quantity + delta, item.maxQuantity) : item.quantity + delta
        return { ...item, quantity }
      })
      .filter(item => item.quantity > 0))
  }

  const removeFromCart = (product: string) => {
    setCart(prev => prev.filter(item => item.product !== product))
  }

  const getDateValidityMessage = (value: string) => {
    if (!value) return ''
    const minDate = getMinOrderDate(hasCookies)
    if (value < minDate) return t('orders.dateError', { days: getOrderLeadDays(hasCookies), date: minDate })
    if (value > getMaxOrderDate()) return t('orders.dateMaxError')
    const blocked = getBlockedRange(value, outOfOfficeRanges)
    if (blocked) return `${t('orders.dateBlockedPrefix')} ${blocked.reason}`
    return ''
  }

  const handleDateChange = (value: string) => {
    setDetails(prev => ({ ...prev, date: value }))
    const message = getDateValidityMessage(value)
    setDateError(message)
    // Collapse back to the compact view once a valid day is picked, same as a native
    // date input closing on selection — keeps the rest of the step in view.
    if (!message) setShowCalendar(false)
  }

  // Adding/removing cookies changes the required lead time, so a date picked earlier
  // can become invalid — re-check it instead of silently keeping a stale selection.
  useEffect(() => {
    if (details.date) setDateError(getDateValidityMessage(details.date))
  }, [hasCookies])

  const formatDisplayDate = (value: string) => {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString(isEn ? 'en-US' : 'es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  const handleDetailsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setDetails(prev => ({ ...prev, [name]: value }))
  }

  const goToConfirm = () => {
    if (!deliveryMethod) {
      setDeliveryMethodError(true)
      return
    }
    const dateMessage = getDateValidityMessage(details.date)
    if (dateMessage || !details.date) {
      setDateError(dateMessage || t('orders.dateError', { days: getOrderLeadDays(hasCookies), date: getMinOrderDate(hasCookies) }))
      setShowCalendar(true)
      return
    }
    setStep('confirm')
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const deliveryFee = getDeliveryFee(deliveryMethod || 'pickup')
  const orderTotal = cartTotal + deliveryFee
  const tax = getTax(orderTotal)
  const grandTotal = orderTotal + tax

  const today = new Date().toISOString().slice(0, 10)
  const upcomingOutOfOffice = outOfOfficeRanges.filter(r => r.endDate >= today).slice(0, 2)

  const submitOrder = async () => {
    setSending(true)
    setSendError(false)
    setCheckoutErrorMessage('')
    // Prices aren't sent here — the server looks up each product's real price and
    // computes delivery fee/tax itself, so a tampered request can't pay less.
    const items = cart.map(item => ({
      productId: item.productId,
      product: isEn && item.productEn ? item.productEn : item.product,
      quantity: item.quantity,
    }))
    const result = await createCheckoutSession({
      items,
      successUrl: `${window.location.origin}/?checkout=success`,
      cancelUrl: `${window.location.origin}/?checkout=cancel`,
      metadata: { date: details.date, notes: details.notes, language: isEn ? 'en' : 'es', deliveryMethod: deliveryMethod || 'pickup' },
    })
    if (!result.url) {
      setSending(false)
      setSendError(true)
      if (result.error === 'DAILY_BREAD_LIMIT_EXCEEDED') {
        setCheckoutErrorMessage(t('orders.breadLimitDaily', { remaining: Math.max(0, result.remaining ?? 0) }))
      } else if (result.error === 'ORDER_BREAD_LIMIT_EXCEEDED') {
        setCheckoutErrorMessage(t('orders.breadLimitPerOrder', { max: MAX_BREAD_PER_ORDER }))
      } else if (result.error === 'DAILY_COOKIE_LIMIT_EXCEEDED') {
        setCheckoutErrorMessage(t('orders.cookieLimitDaily', { remaining: Math.max(0, result.remaining ?? 0) }))
      } else {
        setCheckoutErrorMessage('')
      }
      return
    }
    window.location.href = result.url
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

          {step === 'product' ? (
            <>
              <ChatBubble>
                {isEn ? '👋 Hi! What would you like to order? Add as many products as you need' : '👋 ¡Hola! ¿Qué te gustaría encargar? Agrega todos los productos que necesites'}
              </ChatBubble>

              <div className="flex flex-col gap-2 mt-2">
                {availableProducts.map(p => {
                  const inCart = cart.find(item => item.product === p.name)
                  const atBreadLimit = p.category === BREAD_CATEGORY && breadQuantityInCart >= MAX_BREAD_PER_ORDER && !inCart
                  const atMax = (!!inCart && p.maxQuantity != null && inCart.quantity >= p.maxQuantity) || atBreadLimit
                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      disabled={atMax}
                      className={`text-left px-4 py-3 rounded-2xl border-2 transition-all text-sm font-medium flex items-center justify-between gap-2 ${
                        inCart
                          ? 'border-wine bg-wine text-cream-light'
                          : 'border-rose bg-cream-light text-brown-dark hover:border-wine/60'
                      } ${atMax ? 'cursor-not-allowed opacity-90' : ''}`}
                    >
                      <span>
                        <span className="font-semibold">{isEn && p.nameEn ? p.nameEn : p.name}</span>
                        <span className="ml-2 font-normal opacity-70">${p.price}</span>
                        {p.maxQuantity != null && (
                          <span className="ml-2 font-normal opacity-70 text-xs">
                            ({isEn ? 'max' : 'máx.'} {p.maxQuantity})
                          </span>
                        )}
                      </span>
                      {inCart
                        ? <span className="text-xs font-bold opacity-90">{inCart.quantity} ✓</span>
                        : <ChevronRight size={16} className="flex-shrink-0 opacity-60" />}
                    </button>
                  )
                })}
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
                        <button
                          onClick={() => changeQuantity(item.product, 1)}
                          disabled={(item.maxQuantity != null && item.quantity >= item.maxQuantity) || (item.category === BREAD_CATEGORY && breadQuantityInCart >= MAX_BREAD_PER_ORDER)}
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-brown-dark/10 hover:bg-brown-dark/20 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Plus size={12} />
                        </button>
                        <button onClick={() => removeFromCart(item.product)} className="ml-1 text-brown-dark/60 hover:text-brown-dark">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {breadQuantityInCart >= MAX_BREAD_PER_ORDER && (
                    <p className="text-xs font-semibold text-burgundy">{t('orders.breadLimitPerOrder', { max: MAX_BREAD_PER_ORDER })}</p>
                  )}
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
                  <label className="block text-xs font-semibold text-brown-dark mb-1">{t('orders.deliveryMethodLabel')} *</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setDeliveryMethod('pickup'); setDeliveryMethodError(false) }}
                      className={`flex-1 text-xs font-semibold py-2 rounded-xl border-2 transition-colors ${
                        deliveryMethod === 'pickup' ? 'border-wine bg-wine text-cream-light' : 'border-rose bg-cream text-brown-mid'
                      }`}
                    >
                      {t('orders.deliveryMethodPickup')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDeliveryMethod('delivery'); setDeliveryMethodError(false) }}
                      className={`flex-1 text-xs font-semibold py-2 rounded-xl border-2 transition-colors ${
                        deliveryMethod === 'delivery' ? 'border-wine bg-wine text-cream-light' : 'border-rose bg-cream text-brown-mid'
                      }`}
                    >
                      {t('orders.deliveryMethodDelivery')} (+${DELIVERY_FEE})
                    </button>
                  </div>
                  {deliveryMethodError && <p className="text-xs font-semibold text-burgundy mt-1">{t('orders.deliveryMethodError')}</p>}
                </div>

                <p className="text-xs text-brown-mid">{deliveryMethod === 'delivery' ? t('orders.stripeCollectNote') : t('orders.stripeCollectNotePickup')}</p>

                <div>
                  <label className="block text-xs font-semibold text-brown-dark mb-1">{t('orders.date')} *</label>
                  <p className="text-xs text-brown-mid mb-1">{t('orders.leadTimeNote', { hours: hasCookies ? 72 : 48 })}</p>
                  <button
                    type="button"
                    onClick={() => setShowCalendar(prev => !prev)}
                    className={`${inputClass} flex items-center justify-between gap-2 text-left`}
                  >
                    <span className={`flex items-center gap-2 ${details.date ? 'text-brown-dark font-semibold' : 'text-brown-mid/40'}`}>
                      <Calendar size={14} className="flex-shrink-0" />
                      {details.date ? formatDisplayDate(details.date) : (isEn ? 'Select a date' : 'Selecciona una fecha')}
                    </span>
                    <ChevronRight size={14} className={`flex-shrink-0 text-brown-light transition-transform ${showCalendar ? 'rotate-90' : ''}`} />
                  </button>
                  {dateError && <p className="text-xs font-semibold text-burgundy mt-1.5">{dateError}</p>}
                  {showCalendar && (
                    <div className="mt-2">
                      <DatePicker
                        value={details.date}
                        onChange={handleDateChange}
                        minDate={getMinOrderDate(hasCookies)}
                        maxDate={getMaxOrderDate()}
                        blockedRanges={outOfOfficeRanges}
                        isEn={isEn}
                      />
                      <p className="text-xs text-brown-mid mt-1.5">
                        {t('orders.calendarNote')}{' '}
                        <button
                          type="button"
                          onClick={() => openWhatsAppLink(buildWhatsAppOrderLink(isEn ? 'Hi Ani! I need a special order for an event further than 1 month out.' : '¡Hola Ani! Necesito un pedido especial para un evento con más de 1 mes de anticipación.'))}
                          className="inline-flex items-center gap-1 font-semibold text-wine hover:text-wine-dark underline"
                        >
                          <MessageCircle size={12} /> {t('orders.calendarWriteWhatsApp')}
                        </button>
                      </p>
                      {upcomingOutOfOffice.length > 0 && (
                        <div className="text-xs font-semibold text-burgundy mt-1.5">
                          <p>{t('orders.upcomingOutOfOffice')}:</p>
                          {upcomingOutOfOffice.map(range => (
                            <p key={range.id} className="font-normal">{range.startDate} → {range.endDate} — {range.reason}</p>
                          ))}
                        </div>
                      )}
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
                  {deliveryFee > 0 && (
                    <div className="flex justify-between gap-2">
                      <span className="text-brown-dark">{t('orders.deliveryMethodDelivery')}</span>
                      <span className="text-brown-mid flex-shrink-0">${deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  {tax > 0 && (
                    <div className="flex justify-between gap-2">
                      <span className="text-brown-dark">{t('orders.taxFee', { percent: (TAX_PERCENT * 100).toFixed(0) })}</span>
                      <span className="text-brown-mid flex-shrink-0">${tax.toFixed(2)}</span>
                    </div>
                  )}
                  {grandTotal > 0 && (
                    <div className="flex justify-between gap-2 font-bold text-brown-dark pt-1">
                      <span>{t('admin.total')}</span>
                      <span>${grandTotal.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                {[
                  { icon: '📅', label: t('orders.date'), value: details.date },
                  { icon: deliveryMethod === 'delivery' ? '🚚' : '🏠', label: t('orders.deliveryMethodLabel'), value: t(deliveryMethod === 'delivery' ? 'orders.deliveryMethodDelivery' : 'orders.deliveryMethodPickup') },
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
                {isEn ? 'You\'ll be redirected to a secure payment page 💳' : 'Te voy a redirigir a una página de pago segura 💳'}
              </ChatBubble>
            </>
          )}
        </div>

        {/* Footer nav */}
        <div className="bg-cream-light border-t border-rose px-4 py-3 flex flex-col gap-2 flex-shrink-0">
          {sendError && <p className="text-xs font-semibold text-burgundy">{checkoutErrorMessage || t('orders.stripeSendError')}</p>}
          {step === 'confirm' && orderTotal <= 0 && (
            <p className="text-xs font-semibold text-burgundy">{t('orders.stripeMinTotalError')}</p>
          )}
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
                disabled={sending || orderTotal <= 0}
                className="flex-1 text-white font-bold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed bg-[#635BFF] hover:bg-[#4f46e5]"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                {sending ? (isEn ? 'Redirecting…' : 'Redirigiendo…') : t('orders.submitStripe')}
              </button>
            )}
          </div>
        </div>
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
