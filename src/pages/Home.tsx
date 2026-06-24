import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Products from '../components/Products'
import Orders from '../components/Orders'
import Reviews from '../components/Reviews'
import Contact from '../components/Contact'
import Footer from '../components/Footer'

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Products />
        <Orders />
        <Reviews />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
