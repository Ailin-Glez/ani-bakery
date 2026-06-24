import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, orderBy, query, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

export interface Review {
  id: string
  name: string
  comment: string
  rating: number
  date: string
  approved: boolean
}

interface ReviewContextType {
  approvedReviews: Review[]
  pendingReviews: Review[]
  loading: boolean
  submitReview: (data: { name: string; comment: string; rating: number }) => Promise<void>
  approveReview: (id: string) => Promise<void>
  rejectReview: (id: string) => Promise<void>
  deleteReview: (id: string) => Promise<void>
}

const ReviewContext = createContext<ReviewContextType | null>(null)

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReviews()
  }, [])

  const fetchReviews = async () => {
    setLoading(true)
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Review))
    setLoading(false)
  }

  const approvedReviews = reviews.filter(r => r.approved)
  const pendingReviews = reviews.filter(r => !r.approved)

  const submitReview = async (data: { name: string; comment: string; rating: number }) => {
    const date = new Date().toLocaleDateString('es-US', { month: 'long', year: 'numeric' })
    const ref = await addDoc(collection(db, 'reviews'), {
      ...data, date, approved: false, createdAt: serverTimestamp(),
    })
    setReviews(prev => [{ ...data, date, approved: false, id: ref.id }, ...prev])
  }

  const approveReview = async (id: string) => {
    await updateDoc(doc(db, 'reviews', id), { approved: true })
    setReviews(prev => prev.map(r => r.id === id ? { ...r, approved: true } : r))
  }

  const rejectReview = async (id: string) => {
    await deleteDoc(doc(db, 'reviews', id))
    setReviews(prev => prev.filter(r => r.id !== id))
  }

  const deleteReview = async (id: string) => {
    await deleteDoc(doc(db, 'reviews', id))
    setReviews(prev => prev.filter(r => r.id !== id))
  }

  return (
    <ReviewContext.Provider value={{ approvedReviews, pendingReviews, loading, submitReview, approveReview, rejectReview, deleteReview }}>
      {children}
    </ReviewContext.Provider>
  )
}

export function useReviews() {
  const ctx = useContext(ReviewContext)
  if (!ctx) throw new Error('useReviews must be used within ReviewProvider')
  return ctx
}
