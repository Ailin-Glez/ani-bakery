import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, orderBy, query,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Sale, SaleStatus } from '../types'

interface SalesContextType {
  sales: Sale[]
  loading: boolean
  addSale: (sale: Omit<Sale, 'id' | 'createdAt'>) => Promise<void>
  updateSaleStatus: (id: string, status: SaleStatus) => Promise<void>
  deleteSale: (id: string) => Promise<void>
}

const SalesContext = createContext<SalesContextType | null>(null)

export function SalesProvider({ children }: { children: ReactNode }) {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSales()
  }, [])

  const fetchSales = async () => {
    setLoading(true)
    try {
      const q = query(collection(db, 'sales'), orderBy('date', 'desc'))
      const snap = await getDocs(q)
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Sale))
    } catch (e) {
      console.error('Firebase fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  const addSale = async (sale: Omit<Sale, 'id' | 'createdAt'>) => {
    const createdAt = new Date().toISOString()
    const payload = { ...sale, createdAt }
    const ref = await addDoc(collection(db, 'sales'), payload)
    setSales(prev => [{ ...payload, id: ref.id }, ...prev])
  }

  const updateSaleStatus = async (id: string, status: SaleStatus) => {
    await updateDoc(doc(db, 'sales', id), { status })
    setSales(prev => prev.map(s => s.id === id ? { ...s, status } : s))
  }

  const deleteSale = async (id: string) => {
    await deleteDoc(doc(db, 'sales', id))
    setSales(prev => prev.filter(s => s.id !== id))
  }

  return (
    <SalesContext.Provider value={{ sales, loading, addSale, updateSaleStatus, deleteSale }}>
      {children}
    </SalesContext.Provider>
  )
}

export function useSales() {
  const ctx = useContext(SalesContext)
  if (!ctx) throw new Error('useSales must be used within SalesProvider')
  return ctx
}
