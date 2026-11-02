import { CircleAlert, Minus, Package, Trash2, Wine } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, supabase } from '../lib/supabase'
import type { Category, Product } from '../types'

type Filter = Category | 'all'

const FILTERS: { value: Filter; label: string; active: string }[] = [
  { value: 'all', label: 'Все', active: 'bg-blue-600 text-white' },
  { value: 'canned_food', label: 'Консервы', active: 'bg-orange-500 text-white' },
  { value: 'wine', label: 'Вино', active: 'bg-purple-600 text-white' },
]

const INACTIVE_FILTER =
  'bg-white text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'

export default function Catalog() {
  const [filter, setFilter] = useState<Filter>('all')
  const [products, setProducts] = useState<Product[] | null>(null)
  const [busy, setBusy] = useState<Set<string>>(new Set())

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from('products').select('*').order('name')
      if (error) {
        console.error('Error fetching products:', error)
        setProducts([])
      } else {
        setProducts(data)
      }
    }
    load()

    const channel = supabase
      .channel('products_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const visible = products?.filter((product) => (filter === 'all' ? true : product.category === filter)) ?? null

  const withBusy = async (product: Product, action: () => Promise<void>) => {
    if (busy.has(product.id)) return
    try {
      setBusy((current) => new Set(current).add(product.id))
      await action()
    } catch (error) {
      console.error(error)
      alert('Ошибка при обновлении')
    } finally {
      setBusy((current) => {
        const next = new Set(current)
        next.delete(product.id)
        return next
      })
    }
  }

  const consumeOne = (product: Product) =>
    withBusy(product, async () => {
      if (product.quantity <= 1) {
        if (!window.confirm('Это последняя единица. Удалить продукт из каталога?')) return
        setProducts((current) => current?.filter((item) => item.id !== product.id) ?? null)
        await db.products.delete(product.id)
      } else {
        setProducts(
          (current) =>
            current?.map((item) =>
              item.id === product.id ? { ...item, quantity: item.quantity - 1 } : item,
            ) ?? null,
        )
        await db.products.update(product.id, { quantity: product.quantity - 1 })
      }
      await db.history.add({
        productId: product.id,
        productName: product.name,
        quantityAdded: 1,
        action: 'consume',
        date: Date.now(),
      })
    })

  const removeAll = (product: Product) =>
    withBusy(product, async () => {
      if (!window.confirm('Вы уверены, что хотите полностью удалить этот продукт?')) return
      setProducts((current) => current?.filter((item) => item.id !== product.id) ?? null)
      await db.products.delete(product.id)
      await db.history.add({
        productId: product.id,
        productName: product.name,
        quantityAdded: product.quantity,
        action: 'consume',
        date: Date.now(),
      })
    })

  if (!products) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-6" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="bg-white dark:bg-gray-800 rounded-xl p-3 flex gap-4 h-32">
            <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            <div className="flex-1 space-y-3 py-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 pt-2 pb-4 z-10">
        <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Каталог запасов</h1>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {FILTERS.map(({ value, label, active }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-full whitespace-nowrap flex items-center gap-1 ${filter === value ? active : INACTIVE_FILTER}`}
            >
              {value === 'canned_food' && <Package size={16} />}
              {value === 'wine' && <Wine size={16} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible && visible.length === 0 ? (
        <div className="text-center mt-10 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <Package className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 dark:text-gray-400 mb-4">Пока ничего нет</p>
          <Link to="/add" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium">
            Добавить первый запас
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {visible?.map((product) => {
            const expired =
              product.expirationDate && new Date(product.expirationDate).getTime() < Date.now()
            return (
              <div
                key={product.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden flex flex-col"
              >
                <div className="flex p-3 gap-4">
                  <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                    {product.photoUrl ? (
                      <img
                        src={product.photoUrl}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="text-gray-300" size={32} />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-white line-clamp-2 leading-tight">
                        {product.name}
                      </h3>
                      {product.brand && <p className="text-sm text-gray-500 mt-1">{product.brand}</p>}
                      {(product.manufactureDate || product.expirationDate) && (
                        <div className="text-xs mt-2 space-y-1 bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                          {product.manufactureDate && (
                            <p className="text-gray-500 dark:text-gray-400">
                              Изг: {new Date(product.manufactureDate).toLocaleDateString('ru-RU')}
                            </p>
                          )}
                          {product.expirationDate && (
                            <p className={expired ? 'text-red-500 font-bold' : 'text-gray-500 dark:text-gray-400'}>
                              До: {new Date(product.expirationDate).toLocaleDateString('ru-RU')}
                              {expired && ' (Просрочено)'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-end mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-gray-800 dark:text-white">
                          {product.quantity}
                        </span>
                        <span className="text-sm text-gray-500">шт.</span>
                      </div>
                      {product.minQuantity && product.quantity <= product.minQuantity && (
                        <div className="flex items-center text-amber-500 text-xs font-medium">
                          <CircleAlert size={14} className="mr-1" />
                          Заканчивается
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-2 flex justify-between">
                  <button
                    onClick={() => removeAll(product)}
                    disabled={busy.has(product.id)}
                    className={`p-2 text-red-500 rounded-lg ${busy.has(product.id) ? 'opacity-50' : 'hover:bg-red-50'}`}
                    title="Удалить полностью"
                  >
                    <Trash2 size={20} />
                  </button>
                  <button
                    onClick={() => consumeOne(product)}
                    disabled={busy.has(product.id)}
                    className={`flex-1 ml-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 ${
                      busy.has(product.id)
                        ? 'bg-gray-200 text-gray-400 dark:bg-gray-700'
                        : 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                    }`}
                  >
                    <Minus size={18} />
                    {busy.has(product.id) ? 'Загрузка...' : 'Употребить (1 шт)'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
