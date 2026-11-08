import { Clock, Minus, Plus, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { HistoryEntry, Product } from '../types'

export default function History() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [products, setProducts] = useState<Product[] | null>(null)

  useEffect(() => {
    const loadHistory = async () => {
      const { data } = await supabase.from('history').select('*').order('date', { ascending: false })
      if (data) setEntries(data)
    }
    const loadProducts = async () => {
      const { data } = await supabase.from('products').select('*')
      if (data) setProducts(data)
    }
    loadHistory()
    loadProducts()

    const historyChannel = supabase
      .channel('history_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'history' }, loadHistory)
      .subscribe()
    const productsChannel = supabase
      .channel('products_alert_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, loadProducts)
      .subscribe()

    return () => {
      supabase.removeChannel(historyChannel)
      supabase.removeChannel(productsChannel)
    }
  }, [])

  if (!entries || !products) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-6" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="bg-white dark:bg-gray-800 rounded-xl p-4 flex gap-3 h-20">
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const runningLow = products.filter(
    (product) => product.minQuantity != null && product.quantity <= product.minQuantity,
  )

  return (
    <div className="max-w-md mx-auto pb-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">История и Уведомления</h1>

      {runningLow.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-3 text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <TriangleAlert className="text-amber-500" size={20} />
            Заканчиваются ({runningLow.length})
          </h2>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
            {runningLow.map((product) => (
              <div
                key={product.id}
                className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm"
              >
                <div>
                  <h3 className="font-medium text-gray-800 dark:text-white">{product.name}</h3>
                  <p className="text-xs text-gray-500">Мин. остаток: {product.minQuantity}</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-lg font-bold text-amber-600 dark:text-amber-500">
                    {product.quantity} шт.
                  </span>
                  <Link
                    to="/add"
                    state={{ prefillName: product.name }}
                    className="text-xs text-blue-600 mt-1 flex items-center"
                  >
                    <Plus size={12} /> Пополнить
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold mb-3 text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Clock className="text-blue-500" size={20} />
          История операций
        </h2>
        {entries.length === 0 ? (
          <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm text-gray-500">
            История пуста
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const consumed = entry.action === 'consume'
              return (
                <div
                  key={entry.id}
                  className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm flex items-start gap-3"
                >
                  <div
                    className={`${
                      consumed
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    } p-2 rounded-lg mt-1`}
                  >
                    {consumed ? <Minus size={20} /> : <Plus size={20} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-gray-800 dark:text-white">{entry.productName}</h3>
                      <span className={`font-bold ${consumed ? 'text-red-600' : 'text-green-600'}`}>
                        {consumed ? '-' : '+'}
                        {entry.quantityAdded}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(entry.date).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
