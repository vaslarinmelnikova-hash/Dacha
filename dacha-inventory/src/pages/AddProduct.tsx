import imageCompression from 'browser-image-compression'
import { Camera, Image as ImageIcon, ScanText, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { recognizeLabel, type OcrProgress } from '../lib/labelOcr'
import { parseLabel, toProductDraft, type ParsedLabel } from '../lib/parseLabel'
import { db, uploadPhoto } from '../lib/supabase'
import type { Category } from '../types'

const AUTO_SCAN_KEY = 'dacha-inventory:auto-scan'

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'canned_food', label: 'Консервы' },
  { value: 'wine', label: 'Вино / Алкоголь' },
  { value: 'other', label: 'Прочее' },
]

const FIELD_LABELS: Record<string, string> = {
  name: 'Название',
  brand: 'Бренд',
  manufactureDate: 'Изготовлено',
  expirationDate: 'Годен до',
}

const INPUT_CLASS =
  'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white'
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

export default function AddProduct() {
  const navigate = useNavigate()
  const location = useLocation()
  const prefillName = (location.state as { prefillName?: string } | null)?.prefillName ?? ''

  const galleryInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const scanToken = useRef(0)

  const [preview, setPreview] = useState('')
  const [photoFile, setPhotoFile] = useState<Blob | null>(null)
  const [name, setName] = useState(prefillName)
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState<Category>('canned_food')
  const [quantity, setQuantity] = useState(1)
  const [minQuantity, setMinQuantity] = useState(0)
  const [manufactureDate, setManufactureDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [saving, setSaving] = useState(false)

  const [autoScan, setAutoScan] = useState(true)
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [parsed, setParsed] = useState<ParsedLabel | null>(null)
  const [filledFields, setFilledFields] = useState<string[]>([])
  const [rawText, setRawText] = useState('')
  const [scanError, setScanError] = useState('')

  // Recognition finishes long after the photo was picked, so autofill reads the fields through
  // a ref to see anything typed in the meantime rather than the values it captured back then.
  const typed = useRef({ name, brand, manufactureDate, expirationDate })
  useEffect(() => {
    typed.current = { name, brand, manufactureDate, expirationDate }
  })

  useEffect(() => {
    setAutoScan(localStorage.getItem(AUTO_SCAN_KEY) !== 'off')
  }, [])

  const toggleAutoScan = (enabled: boolean) => {
    setAutoScan(enabled)
    localStorage.setItem(AUTO_SCAN_KEY, enabled ? 'on' : 'off')
  }

  /**
   * Autofill never overwrites something already typed — the camera assists, it does not decide.
   * Overwriting happens only when the user asks for it with "Подставить заново".
   */
  const applyDraft = (label: ParsedLabel, forCategory: Category, overwrite = false) => {
    const draft = toProductDraft(label, forCategory)
    const current = typed.current
    const filled: string[] = []

    if (draft.name && (overwrite || !current.name.trim())) {
      setName(draft.name)
      filled.push('name')
    }
    if (draft.brand && (overwrite || !current.brand.trim())) {
      setBrand(draft.brand)
      filled.push('brand')
    }
    if (draft.manufactureDate && (overwrite || !current.manufactureDate)) {
      setManufactureDate(draft.manufactureDate)
      filled.push('manufactureDate')
    }
    if (draft.expirationDate && (overwrite || !current.expirationDate)) {
      setExpirationDate(draft.expirationDate)
      filled.push('expirationDate')
    }

    setFilledFields(filled)
  }

  const scan = async (image: Blob, forCategory: Category) => {
    const token = ++scanToken.current
    setScanError('')
    setFilledFields([])
    setProgress({ stage: 'preparing', value: 0 })

    try {
      const { text, lines } = await recognizeLabel(image, (update) => {
        if (scanToken.current === token) setProgress(update)
      })
      if (scanToken.current !== token) return

      const label = parseLabel(text, lines)
      setRawText(text.trim())
      setParsed(label)
      applyDraft(label, forCategory)
    } catch (error) {
      console.error('OCR error:', error)
      if (scanToken.current === token) setScanError('Не удалось распознать этикетку. Заполните поля вручную.')
    } finally {
      if (scanToken.current === token) setProgress(null)
    }
  }

  const cancelScan = () => {
    scanToken.current++
    setProgress(null)
  }

  const handlePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    let stored: Blob = file
    try {
      stored = await imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 1024, useWebWorker: false })
    } catch (error) {
      console.error('Compression error:', error)
    }
    setPhotoFile(stored)

    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(stored)

    // The uncompressed original keeps the small print readable for the recognizer.
    if (autoScan) scan(file, category)
  }

  const clearPhoto = () => {
    cancelScan()
    setPreview('')
    setPhotoFile(null)
    setParsed(null)
    setRawText('')
    setFilledFields([])
    setScanError('')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    try {
      const existing = await db.products.findByNameAndCategory(name.trim(), category)
      const now = Date.now()

      let photoUrl: string | undefined
      try {
        if (photoFile) {
          const safeName = name.trim().replace(/[^a-zA-Z0-9]/g, '_')
          photoUrl = await uploadPhoto(photoFile, `${Date.now()}_${safeName}.jpg`)
        }
      } catch (error) {
        const details = error instanceof Error ? error.message : JSON.stringify(error)
        throw new Error(
          `Не удалось загрузить фото в Supabase Storage. Проверьте бакет "products". Детали: ${details}`,
        )
      }

      let productId: string
      if (existing?.id) {
        await db.products.update(existing.id, {
          quantity: existing.quantity + quantity,
          updatedAt: now,
          ...(photoUrl ? { photoUrl } : {}),
          ...(brand ? { brand } : {}),
          ...(minQuantity > 0 ? { minQuantity } : {}),
          ...(manufactureDate ? { manufactureDate } : {}),
          ...(expirationDate ? { expirationDate } : {}),
        })
        productId = existing.id
      } else {
        productId = await db.products.add({
          name: name.trim(),
          category,
          quantity,
          createdAt: now,
          updatedAt: now,
          ...(brand.trim() ? { brand: brand.trim() } : {}),
          ...(minQuantity > 0 ? { minQuantity } : {}),
          ...(manufactureDate ? { manufactureDate } : {}),
          ...(expirationDate ? { expirationDate } : {}),
          ...(photoUrl ? { photoUrl } : {}),
        })
      }

      await db.history.add({
        productId,
        productName: name.trim(),
        quantityAdded: quantity,
        action: 'add',
        date: now,
      })
      navigate('/')
    } catch (error) {
      console.error('Error adding product:', error)
      const details = error instanceof Error ? error.message : JSON.stringify(error)
      alert(`Ошибка при сохранении продукта.\n\nДетали: ${details}`)
    } finally {
      setSaving(false)
    }
  }

  const extras = [
    parsed?.volumeMl ? `объём ${parsed.volumeMl} мл` : null,
    parsed?.abv ? `крепость ${parsed.abv}%` : null,
  ].filter(Boolean) as string[]

  return (
    <div className="max-w-md mx-auto pb-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Добавить позицию</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col items-center gap-3">
          {preview ? (
            <div className="relative w-full aspect-square max-h-64 rounded-xl overflow-hidden bg-gray-100">
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={clearPhoto}
                className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full shadow-lg"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="w-full flex gap-2">
              <button
                type="button"
                onClick={() => cameraInput.current?.click()}
                className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-blue-300 rounded-xl text-blue-500 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <Camera size={32} className="mb-2" />
                <span>Сделать фото</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInput.current?.click()}
                className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <ImageIcon size={32} className="mb-2" />
                <span>Из галереи</span>
              </button>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInput}
            onChange={handlePhoto}
            className="hidden"
          />
          <input type="file" accept="image/*" ref={galleryInput} onChange={handlePhoto} className="hidden" />

          <label className="w-full flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={autoScan}
              onChange={(event) => toggleAutoScan(event.target.checked)}
              className="w-4 h-4"
            />
            Считывать текст с этикетки автоматически
          </label>
        </div>

        {progress && (
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-purple-800 dark:text-purple-200 flex items-center gap-2">
                <ScanText size={18} />
                {progress.stage === 'preparing' ? 'Готовлю распознавание…' : 'Читаю этикетку…'}
              </span>
              <button type="button" onClick={cancelScan} className="text-xs text-purple-700 dark:text-purple-300">
                Отмена
              </button>
            </div>
            <div className="h-2 bg-purple-100 dark:bg-purple-900/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-600 transition-all"
                style={{ width: `${Math.round(progress.value * 100)}%` }}
              />
            </div>
            {progress.stage === 'preparing' && (
              <p className="text-xs text-purple-700 dark:text-purple-300 mt-2">
                При первом запуске загружаются языковые модели, дальше распознавание идёт сразу.
              </p>
            )}
          </div>
        )}

        {scanError && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">{scanError}</p>
        )}

        {parsed && !progress && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <ScanText size={18} className="text-purple-600" />
                Этикетка распознана
              </span>
              <button
                type="button"
                onClick={() => applyDraft(parsed, category, true)}
                className="text-xs text-blue-600"
              >
                Подставить заново
              </button>
            </div>

            {filledFields.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Заполнено: {filledFields.map((field) => FIELD_LABELS[field]).join(', ')}
              </p>
            )}
            {extras.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Также на этикетке: {extras.join(', ')}
              </p>
            )}

            {rawText && (
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer">Весь распознанный текст</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">{rawText}</pre>
              </details>
            )}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm space-y-4">
          <div>
            <label className={LABEL_CLASS}>Название *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={INPUT_CLASS}
              placeholder="Например: Тушенка говяжья"
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Бренд</label>
            <input
              type="text"
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              className={INPUT_CLASS}
              placeholder="Например: Главпродукт"
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Категория</label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as Category)}
              className={INPUT_CLASS}
            >
              {CATEGORIES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Количество</label>
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white dark:bg-gray-700">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-white"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(event) => setQuantity(parseInt(event.target.value) || 1)}
                  className="w-full text-center p-3 border-x border-gray-300 bg-transparent dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-white"
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <label className={LABEL_CLASS}>Мин. остаток</label>
              <input
                type="number"
                min="0"
                value={minQuantity}
                onChange={(event) => setMinQuantity(parseInt(event.target.value) || 0)}
                className={INPUT_CLASS}
                placeholder="Для уведомлений"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Изготовлено</label>
              <input
                type="date"
                value={manufactureDate}
                onChange={(event) => setManufactureDate(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Годен до</label>
              <input
                type="date"
                value={expirationDate}
                onChange={(event) => setExpirationDate(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-medium text-lg disabled:opacity-50 transition-colors"
        >
          <Upload size={24} />
          {saving ? 'Сохранение...' : 'Сохранить в запасы'}
        </button>
      </form>
    </div>
  )
}
