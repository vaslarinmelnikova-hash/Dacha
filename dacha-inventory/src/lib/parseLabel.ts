export interface OcrLine {
  text: string
  /** Height of the line in pixels — the recognizer's best proxy for how prominent the text is. */
  height: number
  /** Distance from the top of the photo, where known. Breaks ties between similar heights. */
  top?: number
  /** 0…100 from the recognizer. Absent when the lines came from plain text. */
  confidence?: number
}

/**
 * Below this the recognizer is guessing at shapes rather than reading letters. On a readable
 * label every line lands in the nineties; on an ornate label photographed round the curve of a
 * dark bottle, nothing clears it. Guessed text is worse than an empty field, because the user
 * has to notice it is wrong and clear it before typing.
 */
const MIN_CONFIDENCE = 70

/** Within this share of the tallest line, two lines count as the same size. */
const TIED_HEIGHT = 0.85

/** How far below a title line, in multiples of its height, a wrapped continuation can start. */
const ADJACENT = 1.8

/** How many lines at the foot of a label can hold the producer's name on their own. */
const FOOTER_LINES = 3

const isLegible = ({ confidence }: OcrLine): boolean => confidence === undefined || confidence >= MIN_CONFIDENCE

export interface ParsedLabel {
  name?: string
  brand?: string
  year?: number
  volumeMl?: number
  abv?: number
  expirationDate?: string
  /** Set only when the label says plainly enough what it is. */
  category?: 'wine'
}

/** Boilerplate that shows up on almost every bottle and never belongs in a product name. */
const BOILERPLATE =
  /(сульфит|содержит|аллерген|хранит|беремен|вред|здоров|импортёр|импортер|изготовит|разлито|адрес|лиценз|штрихкод|масса нетто|годен|срок годности|produce of|product of|contains|sulphite|sulfite|imported|bottled|best before|government warning|alc\b|vol\b|www\.|\.ru\b|\.com\b)/i

/**
 * Appellation wording. It is printed in full on most European wine labels and reads like a
 * title, but it names the designation of origin rather than the wine.
 */
const APPELLATION =
  /(denominazione|indicazione geografica|origine|controllata|protetta|appellation|contr[oô]l[ée]|geschützte|herkunft|denominación|наименовани[ея] по происхождению|защищённым географическим|\b(docg|doc|igt|igp|dop|aoc|aop)\b)/i

const PRODUCER =
  /(château|chateau|domaine|bodega|cantina|cantine|azienda|tenuta|tenute|fattoria|maison|weingut|winery|wines|cellars|vineyard|винодельн|винзавод|винкомбинат|агрофирма|совхоз|об[ъь]единени|комбинат|АО\s|ООО\s|ПАО\s|ЗАО\s)/i

/**
 * Words that describe what kind of company made the wine without naming it. A line built
 * from nothing but these is a caption for the name printed next to it, not the name itself.
 */
const GENERIC_COMPANY =
  /^(производствен|агропромышлен|аграрн|винодельческ|сельскохозяйствен|об[ъь]единени|предприяти|комбинат|завод|фирм|компани|групп)\p{L}*$/iu

/** Wording that marks the bottle as wine rather than something to eat. */
const WINE =
  /(\bвино\b|\bвина\b|винный|игрист|портвейн|херес|мадера|вермут|шампанск|мускат|каберне|саперави|шардоне|рислинг|пино|мерло|совиньон|\bwine\b|\bvino\b|\bvin\b|pinot|grigio|merlot|cabernet|chardonnay|sauvignon|riesling|syrah|shiraz|malbec|tempranillo|sangiovese|prosecco|spumante|\bbrut\b|\bsec\b|rioja|chianti|valpolicella|toscana|bordeaux|rosé|rosato)/i

/** True when the label reads like a bottle of wine. */
export const looksLikeWine = (text: string): boolean => WINE.test(text) || APPELLATION.test(text)

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
  if (BOILERPLATE.test(line) || APPELLATION.test(line) || MEASUREMENT.test(line)) return -1

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

  // Measured heights carry up to a fifth of noise, enough for the grape variety to outmeasure
  // a title set half again as large. Everything close to the tallest counts as tied, and among
  // tied lines the one printed highest wins, because that is where a label puts its name.
  const tallest = Math.max(...eligible.map((line) => line.height))
  const contenders = tallest > 0 ? eligible.filter((line) => line.height >= tallest * TIED_HEIGHT) : eligible

  const best = contenders.reduce((winner, line) => {
    if (line.top !== undefined && winner.top !== undefined && line.top !== winner.top) {
      return line.top < winner.top ? line : winner
    }
    if (line.height !== winner.height) return line.height > winner.height ? line : winner
    return line.score > winner.score ? line : winner
  })

  const parts = [best.text]
  if (best.height > 0) {
    // Backwards first, and only with positions to go on: the second line of a title regularly
    // measures the taller of the two, which would otherwise leave the opening words behind.
    let lead = best
    for (let index = scored.indexOf(best) - 1; index >= 0 && lead.top !== undefined; index--) {
      const previous = scored[index]
      if (previous.score <= 0 || previous.top === undefined) break
      if (previous.height < best.height * 0.65) break
      if (lead.top - previous.top > previous.height * ADJACENT) break
      parts.unshift(previous.text)
      lead = previous
    }

    let anchor = best
    for (let index = scored.indexOf(best) + 1; index < scored.length; index++) {
      const next = scored[index]
      // Generous ratio: at one font size, a line of ascenders and descenders measures much
      // taller than a line without them, so same-size title lines are far from equal.
      if (next.score <= 0 || next.height < best.height * 0.65) break
      // A title continues on the very next line. Anything further down the label is a
      // separate statement that happens to be printed at a similar size.
      if (anchor.top !== undefined && next.top !== undefined && next.top - anchor.top > anchor.height * ADJACENT) break
      parts.push(next.text)
      anchor = next
    }
  }
  return parts.join(' ')
}

const isAllGeneric = (line: string): boolean => {
  const words = line.split(/[\s,.;:()/]+|(?<=\p{L})-(?=\p{L})/u).filter((word) => countLetters(word) > 0)
  return words.length > 0 && words.every((word) => GENERIC_COMPANY.test(word))
}

const couldBeBrand = (line: string): boolean =>
  !BOILERPLATE.test(line) && !APPELLATION.test(line) && !MEASUREMENT.test(line) && countLetters(line) >= 3

/**
 * The producer, by the two ways labels state it. Either a line says what kind of company it
 * is — a winery, an association — and the name sits in that line or on the one beside it, or
 * nothing says it at all and the name is set on its own in small capitals along the bottom.
 */
/**
 * The producer where the label says so outright: a line that names the kind of company. When
 * that line is nothing but the kind — "производственно-аграрное объединение" — the house is
 * named on the line beside it. This reading is firm enough to keep the name off that line.
 */
export const pickProducer = (lines: OcrLine[]): string | undefined => {
  const index = lines.findIndex(({ text }) => PRODUCER.test(text) && countLetters(text) <= 40)
  if (index < 0) return undefined

  const line = lines[index].text
  if (!isAllGeneric(line)) return line
  return [lines[index + 1], lines[index - 1]].find((near) => near && couldBeBrand(near.text))?.text
}

export const pickBrand = (lines: OcrLine[], name?: string): string | undefined => {
  const producer = pickProducer(lines)
  if (producer && producer !== name) return producer

  // Otherwise the convention of a wine label: the house set by itself in small capitals at
  // the foot. One word only — anything longer down there is as likely to be the wine itself.
  return lines
    .slice(-FOOTER_LINES)
    .reverse()
    .find(({ text }) => {
      if (/\s/.test(text) || text === name || name?.includes(text) || !couldBeBrand(text)) return false
      const letters = countLetters(text)
      if (letters < 4 || letters > 20) return false
      return (text.match(/\p{Lu}/gu) ?? []).length / letters > 0.8
    })?.text
}

export const parseLabel = (text: string, lines?: OcrLine[]): ParsedLabel => {
  const all = lines?.length ? lines : normalizeLines(text)
  const candidates = all.filter(isLegible)
  // Read the numbers off the lines that survived, so a misread one cannot contribute a
  // year or a volume. Plain text has no lines to weigh and is taken as it comes.
  const scanned = lines?.length ? candidates.map((line) => line.text).join('\n') : text
  // A producer the label names outright is settled first, so the title is chosen from what is
  // left: where the house name is the largest word, the wine itself is the next thing down.
  const producer = pickProducer(candidates)
  const name = pickName(producer ? candidates.filter((line) => line.text !== producer) : candidates)

  return {
    name,
    brand: pickBrand(candidates, name),
    year: findYear(candidates),
    category: looksLikeWine(scanned) ? 'wine' : undefined,
    volumeMl: findVolumeMl(scanned),
    abv: findAbv(scanned),
    expirationDate: findExpirationDate(scanned),
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
