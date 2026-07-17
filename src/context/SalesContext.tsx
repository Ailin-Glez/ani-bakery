import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, orderBy, query,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './AuthContext'
import type { Sale, PaymentMethod } from '../types'

interface SalesContextType {
  sales: Sale[]
  loading: boolean
  addSale: (sale: Omit<Sale, 'id' | 'createdAt'>) => Promise<void>
  confirmOrder: (sale: Sale) => Promise<void>
  cancelOrder: (sale: Sale) => Promise<void>
  markDelivered: (sale: Sale) => Promise<void>
  markDeliveredCashOnDelivery: (sale: Sale) => Promise<void>
  markOrderPaid: (sale: Sale, paymentMethod: PaymentMethod) => Promise<void>
  deleteSale: (sale: Sale) => Promise<void>
}

const SalesContext = createContext<SalesContextType | null>(null)

export function SalesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchSales()
    } else {
      setSales([])
      setLoading(false)
    }
  }, [user])

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

  const updateSale = async (sale: Sale, changes: Partial<Sale>) => {
    await updateDoc(doc(db, 'sales', sale.id), changes)
    setSales(prev => prev.map(s => s.id === sale.id ? { ...s, ...changes } : s))
  }

  const confirmOrder = async (sale: Sale) => {
    await updateSale(sale, { status: 'pending_payment' })
  }

  const cancelOrder = async (sale: Sale) => {
    if (sale.paid) throw new Error('Cannot cancel a paid order')
    await updateSale(sale, { status: 'cancelled' })
  }

  const markDelivered = async (sale: Sale) => {
    await updateSale(sale, { status: 'delivered' })
  }

  // For trusted customers who pay in person (cash) at delivery time, skipping the
  // explicit "mark as paid" step — this marks both paid and delivered together.
  const markDeliveredCashOnDelivery = async (sale: Sale) => {
    const paidAt = new Date().toISOString()
    await updateSale(sale, { paid: true, paymentMethod: 'cash', paidAt, status: 'delivered' })
  }

  const markOrderPaid = async (sale: Sale, paymentMethod: PaymentMethod) => {
    const paidAt = new Date().toISOString()
    await updateSale(sale, { paid: true, paymentMethod, paidAt, status: 'in_progress' })
  }

  const deleteSale = async (sale: Sale) => {
    if (sale.paid) throw new Error('Cannot delete a paid sale')
    await deleteDoc(doc(db, 'sales', sale.id))
    setSales(prev => prev.filter(s => s.id !== sale.id))
  }

  return (
    <SalesContext.Provider value={{ sales, loading, addSale, confirmOrder, cancelOrder, markDelivered, markDeliveredCashOnDelivery, markOrderPaid, deleteSale }}>
      {children}
    </SalesContext.Provider>
  )
}

export function useSales() {
  const ctx = useContext(SalesContext)
  if (!ctx) throw new Error('useSales must be used within SalesProvider')
  return ctx
}
