import { useState } from 'react'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Products from '../components/Products'
import Reviews from '../components/Reviews'
import Contact from '../components/Contact'
import Footer from '../components/Footer'
import OrderChat, { FloatingOrderButton } from '../components/OrderChat'

export default function Home() {
  const [chatOpen, setChatOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<string | undefined>()
  const [selectedIsPack, setSelectedIsPack] = useState(false)

  const openChat = (product?: string, isPack?: boolean) => {
    setSelectedProduct(product)
    setSelectedIsPack(!!isPack)
    setChatOpen(true)
  }

  const closeChat = () => {
    setChatOpen(false)
    setSelectedProduct(undefined)
    setSelectedIsPack(false)
  }

  return (
    <>
      <Navbar />
      <main>
        <Hero onOrderClick={() => openChat()} />
        <Products onOrderClick={openChat} />
        <Reviews />
        <Contact />
      </main>
      <Footer />
      <FloatingOrderButton onClick={() => openChat()} />
      <OrderChat open={chatOpen} onClose={closeChat} initialProduct={selectedProduct} initialIsPack={selectedIsPack} />
    </>
  )
}
