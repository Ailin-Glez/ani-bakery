import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Products from '../components/Products'
import Reviews from '../components/Reviews'
import Contact from '../components/Contact'
import Footer from '../components/Footer'
import OrderChat, { FloatingOrderButton } from '../components/OrderChat'

export default function Home() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [chatOpen, setChatOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<string | undefined>()

  const checkoutResult = searchParams.get('checkout')
  const dismissCheckoutBanner = () => setSearchParams(prev => { prev.delete('checkout'); return prev }, { replace: true })

  // The banner renders at the very top of the page, but the user may come back
  // scrolled halfway down (e.g. they'd scrolled the cart before paying, or the
  // browser restored their prior scroll position from bfcache) — force them back
  // to the top so the success/cancel message is actually visible.
  useEffect(() => {
    if (checkoutResult === 'success' || checkoutResult === 'cancel') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [checkoutResult])

  const openChat = (product?: string) => {
    setSelectedProduct(product)
    setChatOpen(true)
  }

  const closeChat = () => {
    setChatOpen(false)
    setSelectedProduct(undefined)
  }

  return (
    <>
      <Navbar />
      {(checkoutResult === 'success' || checkoutResult === 'cancel') && (
        <div className={`flex items-center justify-between gap-3 px-5 py-3 text-sm font-semibold text-white ${checkoutResult === 'success' ? 'bg-wine' : 'bg-burgundy'}`}>
          <span>
            {t(checkoutResult === 'success' ? 'orders.checkoutSuccessTitle' : 'orders.checkoutCancelTitle')}
            {' — '}
            {t(checkoutResult === 'success' ? 'orders.checkoutSuccessText' : 'orders.checkoutCancelText')}
          </span>
          <button onClick={dismissCheckoutBanner} className="flex-shrink-0 text-white/80 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}
      <main>
        <Hero onOrderClick={() => openChat()} />
        <Products onOrderClick={openChat} />
        <Reviews />
        <Contact />
      </main>
      <Footer />
      <FloatingOrderButton onClick={() => openChat()} />
      <OrderChat open={chatOpen} onClose={closeChat} initialProduct={selectedProduct} />
    </>
  )
}
