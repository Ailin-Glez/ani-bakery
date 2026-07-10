import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProductProvider } from './context/ProductContext'
import { ReviewProvider } from './context/ReviewContext'
import { SalesProvider } from './context/SalesContext'
import { OutOfOfficeProvider } from './context/OutOfOfficeContext'
import Home from './pages/Home'
import Admin from './pages/Admin'
import './index.css'

export default function App() {
  return (
    <ProductProvider>
      <ReviewProvider>
        <SalesProvider>
          <OutOfOfficeProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/admin" element={<Admin />} />
              </Routes>
            </BrowserRouter>
          </OutOfOfficeProvider>
        </SalesProvider>
      </ReviewProvider>
    </ProductProvider>
  )
}
