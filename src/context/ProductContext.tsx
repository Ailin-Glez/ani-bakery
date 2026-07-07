import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, orderBy, query, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Product } from '../types'

interface ProductContextType {
  products: Product[]
  loading: boolean
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>
  updateProduct: (id: string, product: Omit<Product, 'id'>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
}

const ProductContext = createContext<ProductContextType | null>(null)

export function ProductProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const q = query(collection(db, 'products'), orderBy('createdAt', 'asc'))
      const snap = await getDocs(q)
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Product))
    } catch (e) {
      console.error('Firebase fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  const addProduct = async (product: Omit<Product, 'id'>) => {
    const ref = await addDoc(collection(db, 'products'), { ...product, createdAt: serverTimestamp() })
    setProducts(prev => [...prev, { ...product, id: ref.id }])
  }

  const updateProduct = async (id: string, product: Omit<Product, 'id'>) => {
    await updateDoc(doc(db, 'products', id), { ...product })
    setProducts(prev => prev.map(p => p.id === id ? { ...product, id } : p))
  }

  const deleteProduct = async (id: string) => {
    await deleteDoc(doc(db, 'products', id))
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  return (
    <ProductContext.Provider value={{ products, loading, addProduct, updateProduct, deleteProduct }}>
      {children}
    </ProductContext.Provider>
  )
}

export function useProducts() {
  const ctx = useContext(ProductContext)
  if (!ctx) throw new Error('useProducts must be used within ProductProvider')
  return ctx
}
