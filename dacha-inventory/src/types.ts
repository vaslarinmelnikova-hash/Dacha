export type Category = 'canned_food' | 'wine' | 'other'

export interface Product {
  id: string
  name: string
  brand?: string | null
  category: Category
  quantity: number
  minQuantity?: number | null
  manufactureDate?: string | null
  expirationDate?: string | null
  photoUrl?: string | null
  createdAt: number
  updatedAt: number
}

export interface HistoryEntry {
  id: string
  productId: string
  productName: string
  quantityAdded: number
  action: 'add' | 'consume'
  date: number
}
