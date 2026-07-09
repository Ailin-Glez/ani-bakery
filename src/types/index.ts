export interface Product {
  id: string
  name: string
  description: string
  nameEn?: string
  descriptionEn?: string
  price: number
  image: string
  category: string
  categoryEn?: string
  available: boolean
}

export interface Review {
  id: string
  name: string
  comment: string
  rating: number
  date: string
}

export interface OrderFormData {
  name: string
  phone: string
  product: string
  quantity: number
  date: string
  notes: string
}

export type SaleStatus = 'pending_confirmation' | 'pending_payment' | 'in_progress' | 'delivered' | 'cancelled'
export type SaleSource = 'web' | 'manual'
export type PaymentMethod = 'zelle' | 'cash' | 'other'
export type ContactMethod = 'phone' | 'email'
export type SaleLanguage = 'es' | 'en'

export interface Sale {
  id: string
  orderId: string
  customerName: string
  phone: string
  email?: string
  contactMethod: ContactMethod
  productName: string
  quantity: number
  unitPrice: number
  total: number
  date: string
  notes: string
  status: SaleStatus
  source: SaleSource
  createdAt: string
  paid: boolean
  paymentMethod?: PaymentMethod
  paidAt?: string
  language?: SaleLanguage
}
