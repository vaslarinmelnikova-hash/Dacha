export interface OcrLine {
  text: string
  /** Height of the line in pixels — the recognizer's best proxy for how prominent the text is. */
  height: number
}

export interface ParsedLabel {
  name?: string
  brand?: string
  year?: number
  volumeMl?: number
  abv?: number
  expirationDate?: string
}

/** Boilerplate that shows up on almost every bottle and never belongs in a product name. */
const BOILERPLATE =
  /(сульфит|содержит|аллерген|хранит|беремен|вред|здоров|импортёр|импортер|изготовит|разлито|адрес|лиценз|штрихкод|масса нетто|годен|срок годности|produce of|product of|contains|sulphite|sulfite|imported|bottled|best before|government warning|alc\b|vol\b|www\.|\.ru\b|\.com\b)/i

const PRODUCER =
  /(château|chateau|domaine|bodega|cantina|tenuta|weingut|winery|wines|cellars|vineyard|винодельн|винзавод|винкомбинат|агрофирма|совхоз|АО\s|ООО\s|ПАО\s|ЗАО\s)/i

const MEASUREMENT = /(\d\s*%)|(\d\s*(мл|ml|cl|сл|л|l)(?!\p{L}))/iu

/** OCR routinely reads these glyphs as letters inside numbers. */
const fixDigits = (value: string): string =>
  value
    .replace(/[oOоО]/g, '0')
    .replace(/[lI|іІ]/g, '1')
    .replace(/[зЗ]/g, '3')
    .replace(/[бБ]/g, '6')

const toNumber = (value: string): number => parseFloat(fixDigits(value).replace(',', '.'))

const countLetters = (line: string): number => (line.match(/\p{L}/gu) ?? []).length

export const normalizeLines = (text: string): OcrLine[] =>
  text
    .split('\n')
    .map((line) => ({ text: line.replace(/\s+/g, ' ').trim(), height: 0 }))
    .filter((line) => (line.text.match(/[\p{L}\p{N}]/gu) ?? []).length >= 2)

export const findYear = (lines: OcrLine[]): number | undefined => {
  const thisYear = new Date().getFullYear()
  const candidates: { year: number; alone: boolean }[] = []

  for (const { text } of lines) {
    for (const match of text.matchAll(/(?<!\d)(1[89]\d{2}|20\d{2})(?!\d)/g)) {
      const year = Number(match[1])
      if (year < 1900 || year > thisYear) continue
      candidates.push({ year, alone: text.replace(/\D/g, '').length === 4 })
    }
  }
  if (candidates.length === 0) return undefined

  // A vintage is usually printed on a line of its own; otherwise take the newest plausible year.
  const alone = candidates.filter((candidate) => candidate.alone)
  const pool = alone.length > 0 ? alone : candidates
  return Math.max(...pool.map((candidate) => candidate.year))
}

export const findVolumeMl = (text: string): number | undefined => {
  const match = text.match(/([0-9oOоО]{1,4}(?:[.,]\d{1,3})?)\s*(мл|ml|cl|сл|л|l)(?!\p{L})/iu)
  if (!match) return undefined

  const amount = toNumber(match[1])
  if (!Number.isFinite(amount)) return undefined

  const unit = match[2].toLowerCase()
  const ml =
    unit === 'мл' || unit === 'ml'
      ? amount
      : unit === 'cl' || unit === 'сл'
        ? amount * 10
        : amount * 1000
  return ml >= 50 && ml <= 20000 ? Math.round(ml) : undefined
}

export const findAbv = (text: string): number | undefined => {
  const match = text.match(/(\d{1,2}(?:[.,]\d)?)\s*%/)
  if (!match) return undefined

  const abv = toNumber(match[1])
  return abv > 0 && abv <= 70 ? abv : undefined
}

const lastDayOfMonth = (year: number, month: number): number => new Date(year, month, 0).getDate()

const toIsoDate = (day: number, month: number, year: number): string | undefined => {
  if (month < 1 || month > 12 || day < 1 || day > lastDayOfMonth(year, month)) return undefined
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const expandYear = (value: string): number => (value.length === 2 ? 2000 + Number(value) : Number(value))

export const findExpirationDate = (text: string): string | undefined => {
  const full = text.match(/([0-3]?\d)[./-]([01]?\d)[./-](\d{4}|\d{2})/)
  if (full) {
    const iso = toIsoDate(Number(full[1]), Number(full[2]), expandYear(full[3]))
    if (iso) return iso
  }

  const monthOnly = text.match(/(?:годен до|до)[:\s]*([01]?\d)[./-](\d{4}|\d{2})/i)
  if (monthOnly) {
    const month = Number(monthOnly[1])
    const year = expandYear(monthOnly[2])
    if (month >= 1 && month <= 12) return toIsoDate(lastDayOfMonth(year, month), month, year)
  }

  return undefined
}

const scoreAsName = (line: string): number => {
  if (BOILERPLATE.test(line) || MEASUREMENT.test(line)) return -1

  const letters = countLetters(line)
  if (letters < 3 || letters > 40) return -1

  const uppercase = (line.match(/\p{Lu}/gu) ?? []).length
  const digits = (line.match(/\d/g) ?? []).length
  return letters + (uppercase / letters > 0.6 ? 6 : 0) - digits * 2
}

/**
 * The product name is the largest text on the label. Falls back to a text-shape score when
 * line heights are unavailable, and absorbs a following line of the same size so that a title
 * wrapped across two lines stays in one piece.
 */
export const pickName = (lines: OcrLine[]): string | undefined => {
  const scored = lines.map((line) => ({ ...line, score: scoreAsName(line.text) }))
  const eligible = scored.filter((line) => line.score > 0)
  if (eligible.length === 0) return undefined

  const best = eligible.reduce((winner, line) =>
    line.height !== winner.height ? (line.height > winner.height ? line : winner) : line.score > winner.score ? line : winner,
  )

  const parts = [best.text]
  if (best.height > 0) {
    for (let index = scored.indexOf(best) + 1; index < scored.length; index++) {
      const next = scored[index]
      if (next.score <= 0 || next.height < best.height * 0.8) break
      parts.push(next.text)
    }
  }
  return parts.join(' ')
}

export const pickBrand = (lines: OcrLine[], name?: string): string | undefined =>
  lines.find(({ text }) => text !== name && PRODUCER.test(text) && countLetters(text) <= 40)?.text

export const parseLabel = (text: string, lines?: OcrLine[]): ParsedLabel => {
  const candidates = lines?.length ? lines : normalizeLines(text)
  const name = pickName(candidates)

  return {
    name,
    brand: pickBrand(candidates, name),
    year: findYear(candidates),
    volumeMl: findVolumeMl(text),
    abv: findAbv(text),
    expirationDate: findExpirationDate(text),
  }
}

export interface ProductDraft {
  name: string
  brand: string
  manufactureDate: string
  expirationDate: string
}

/**
 * Turns a parsed label into values for the add-product form. Vintages of the same wine are
 * separate products, so the year goes into the name — the form merges by name and would
 * otherwise stack different vintages onto one card.
 */
export const toProductDraft = (parsed: ParsedLabel, category: string): Partial<ProductDraft> => {
  const draft: Partial<ProductDraft> = {}

  if (parsed.name) {
    draft.name = category === 'wine' && parsed.year ? `${parsed.name}, ${parsed.year}` : parsed.name
  }
  if (parsed.brand) draft.brand = parsed.brand
  if (parsed.year) draft.manufactureDate = `${parsed.year}-01-01`
  if (parsed.expirationDate) draft.expirationDate = parsed.expirationDate

  return draft
}
