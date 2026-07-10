import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import {
  collection, getDocs, addDoc, deleteDoc,
  doc, orderBy, query,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { OutOfOfficeRange } from '../types'

interface OutOfOfficeContextType {
  ranges: OutOfOfficeRange[]
  loading: boolean
  addRange: (range: Omit<OutOfOfficeRange, 'id' | 'createdAt'>) => Promise<void>
  deleteRange: (range: OutOfOfficeRange) => Promise<void>
}

const OutOfOfficeContext = createContext<OutOfOfficeContextType | null>(null)

export function OutOfOfficeProvider({ children }: { children: ReactNode }) {
  const [ranges, setRanges] = useState<OutOfOfficeRange[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRanges()
  }, [])

  const fetchRanges = async () => {
    setLoading(true)
    try {
      const q = query(collection(db, 'outOfOffice'), orderBy('startDate', 'asc'))
      const snap = await getDocs(q)
      setRanges(snap.docs.map(d => ({ id: d.id, ...d.data() }) as OutOfOfficeRange))
    } catch (e) {
      console.error('Firebase fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  const addRange = async (range: Omit<OutOfOfficeRange, 'id' | 'createdAt'>) => {
    const createdAt = new Date().toISOString()
    const payload = { ...range, createdAt }
    const ref = await addDoc(collection(db, 'outOfOffice'), payload)
    setRanges(prev => [...prev, { ...payload, id: ref.id }].sort((a, b) => a.startDate.localeCompare(b.startDate)))
  }

  const deleteRange = async (range: OutOfOfficeRange) => {
    await deleteDoc(doc(db, 'outOfOffice', range.id))
    setRanges(prev => prev.filter(r => r.id !== range.id))
  }

  return (
    <OutOfOfficeContext.Provider value={{ ranges, loading, addRange, deleteRange }}>
      {children}
    </OutOfOfficeContext.Provider>
  )
}

export function useOutOfOffice() {
  const ctx = useContext(OutOfOfficeContext)
  if (!ctx) throw new Error('useOutOfOffice must be used within OutOfOfficeProvider')
  return ctx
}
