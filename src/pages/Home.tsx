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
      <Navbar onOrderClick={() => openChat()} />
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
