import { CirclePlus, History as HistoryIcon, House } from 'lucide-react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { supabaseConfigError } from './lib/supabase'
import AddProduct from './pages/AddProduct'
import Catalog from './pages/Catalog'
import History from './pages/History'

const NAV = [
  { to: '/', label: 'Каталог', Icon: House },
  { to: '/add', label: 'Добавить', Icon: CirclePlus },
  { to: '/history', label: 'История', Icon: HistoryIcon },
]

export default function App() {
  if (supabaseConfigError) {
    return (
      <div className="max-w-md mx-auto p-6 text-gray-800 dark:text-white">
        <h1 className="text-xl font-bold mb-2">Приложение не настроено</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{supabaseConfigError}</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
        <main className="flex-1 overflow-y-auto p-4 pb-24">
          <Routes>
            <Route path="/" element={<Catalog />} />
            <Route path="/add" element={<AddProduct />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>
        <nav className="fixed bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-around items-center p-3">
            {NAV.map(({ to, label, Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-center text-gray-500 hover:text-blue-500 active:text-blue-600"
              >
                <Icon size={24} />
                <span className="text-xs mt-1">{label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </BrowserRouter>
  )
}
