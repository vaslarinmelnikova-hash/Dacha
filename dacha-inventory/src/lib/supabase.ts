import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { HistoryEntry, Product } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

const HOST_ONLY = /^https:\/\/[\w-]+(\.[\w-]+)+(:\d+)?\/?$/

const stub = () => createClient('http://localhost', 'missing-key')

// createClient rejects a malformed URL by throwing while this module is still being imported,
// which leaves a blank page and nothing to read. Catching it turns a typo in the deployment
// settings into a message on screen.
const connect = (): { client: SupabaseClient; error: string | null } => {
  if (!url || !key) {
    return {
      client: stub(),
      error: 'Не заданы переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.',
    }
  }
  // A value pasted with anything trailing it — a comma, a second variable, a stray word — still
  // parses as a URL, so createClient accepts it and every request quietly fails DNS instead.
  if (!HOST_ONLY.test(url)) {
    return {
      client: stub(),
      error:
        `В VITE_SUPABASE_URL лишний текст: «${url}».\n\n` +
        'Значением должен быть только адрес, без запятых, пробелов и имени второй переменной. ' +
        'Например: https://имя-проекта.supabase.co',
    }
  }
  if (/\s/.test(key)) {
    return {
      client: stub(),
      error: 'В VITE_SUPABASE_ANON_KEY попали пробелы или перенос строки. Вставьте ключ одной строкой.',
    }
  }
  try {
    return { client: createClient(url, key), error: null }
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    return {
      client: stub(),
      error: `Неверное значение VITE_SUPABASE_URL (${url}). ${details}`,
    }
  }
}

const connection = connect()

export const supabase = connection.client
export const supabaseConfigError = connection.error

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
