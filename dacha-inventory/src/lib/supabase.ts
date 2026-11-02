import { createClient } from '@supabase/supabase-js'
import type { HistoryEntry, Product } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigError =
  url && key
    ? null
    : 'Не заданы переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.'

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing-key')

export const uploadPhoto = async (file: Blob, fileName: string): Promise<string> => {
  const { data, error } = await supabase.storage
    .from('products')
    .upload(`${Date.now()}_${fileName}`, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  const { data: published } = supabase.storage.from('products').getPublicUrl(data.path)
  return published.publicUrl
}

export const db = {
  products: {
    add: async (product: Omit<Product, 'id'>): Promise<string> => {
      const { data, error } = await supabase.from('products').insert([product]).select().single()
      if (error) throw error
      return data.id
    },
    update: async (id: string, patch: Partial<Product>): Promise<void> => {
      const { error } = await supabase.from('products').update(patch).eq('id', id)
      if (error) throw error
    },
    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
    },
    findByNameAndCategory: async (name: string, category: string): Promise<Product | null> => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('name', name)
        .eq('category', category)
        .maybeSingle()
      if (error && error.code !== 'PGRST116') throw error
      return data
    },
  },
  history: {
    add: async (entry: Omit<HistoryEntry, 'id'>): Promise<string> => {
      const { data, error } = await supabase.from('history').insert([entry]).select().single()
      if (error) throw error
      return data.id
    },
  },
}
