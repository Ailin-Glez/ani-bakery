import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProductProvider } from './context/ProductContext'
import { ReviewProvider } from './context/ReviewContext'
import { SalesProvider } from './context/SalesContext'
import { OutOfOfficeProvider } from './context/OutOfOfficeContext'
import Home from './pages/Home'
import './index.css'

const Admin = lazy(() => import('./pages/Admin'))

export default function App() {
  return (
    <AuthProvider>
      <ProductProvider>
        <ReviewProvider>
          <SalesProvider>
            <OutOfOfficeProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route
                    path="/admin"
                    element={
                      <Suspense fallback={<div className="min-h-screen bg-cream" />}>
                        <Admin />
                      </Suspense>
                    }
                  />
                </Routes>
              </BrowserRouter>
            </OutOfOfficeProvider>
          </SalesProvider>
        </ReviewProvider>
      </ProductProvider>
    </AuthProvider>
  )
}
