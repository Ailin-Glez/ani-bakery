export interface Product {
  id: string
  name: string
  description: string
  nameEn?: string
  descriptionEn?: string
  price: number
  image: string
  category: string
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
