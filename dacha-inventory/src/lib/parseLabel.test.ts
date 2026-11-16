import { describe, expect, it } from 'vitest'
import {
  findAbv,
  findExpirationDate,
  findVolumeMl,
  findYear,
  normalizeLines,
  parseLabel,
  pickName,
  toProductDraft,
  type OcrLine,
} from './parseLabel'

const WINE_LABEL = `МАССАНДРА
Мускат белый
красного камня
2019
Вино ликёрное белое
Винодельня Массандра, Крым
0,75 л алк. 16 % об.
Содержит сульфиты`

/** Line heights as reported by the recognizer for the same label. */
const WINE_LINES: OcrLine[] = [
  { text: 'МАССАНДРА', height: 63 },
  // 'Мускат белый' carries both an ascender and a descender; the next line of the same font
  // size measures noticeably shorter.
  { text: 'Мускат белый', height: 95 },
  { text: 'красного камня', height: 68 },
  { text: '2019', height: 65 },
  { text: 'Вино ликёрное белое', height: 42 },
  { text: 'Винодельня Массандра, Крым', height: 36 },
  { text: '0,75 л алк. 16 % об.', height: 37 },
  { text: 'Содержит сульфиты', height: 31 },
]

const CANNED_LABEL = `ГЛАВПРОДУКТ
Тушенка говяжья
высший сорт
Масса нетто 338 г
Годен до 14.08.2027
Хранить при температуре от 0 до 20 C`

describe('normalizeLines', () => {
  it('keeps number-only lines such as a vintage', () => {
    expect(normalizeLines('Вино\n\n  ---  \n 2019 \n').map((line) => line.text)).toEqual(['Вино', '2019'])
  })
})

describe('findYear', () => {
  it('prefers a vintage printed on its own line', () => {
    expect(findYear(normalizeLines(WINE_LABEL))).toBe(2019)
  })

  it('ignores numbers that are not plausible years', () => {
    expect(findYear(normalizeLines('Масса нетто 338 г\nПартия 9912'))).toBeUndefined()
  })
})

describe('findVolumeMl', () => {
  it.each([
    ['0,75 л', 750],
    ['750 мл', 750],
    ['750 ml', 750],
    ['1 L', 1000],
    ['50 cl', 500],
  ])('reads %s', (text, expected) => {
    expect(findVolumeMl(text)).toBe(expected)
  })

  it('recovers from a letter O misread as zero', () => {
    expect(findVolumeMl('О,75 л')).toBe(750)
  })

  it('does not mistake a word starting with the unit letter for a volume', () => {
    expect(findVolumeMl('Партия 12 литраж не указан')).toBeUndefined()
  })
})

describe('findAbv', () => {
  it('reads strength with a decimal comma', () => {
    expect(findAbv('алк. 12,5 % об.')).toBe(12.5)
  })
})

describe('findExpirationDate', () => {
  it('reads a full date', () => {
    expect(findExpirationDate(CANNED_LABEL)).toBe('2027-08-14')
  })

  it('expands a month-only date to the end of that month', () => {
    expect(findExpirationDate('Годен до 02.2028')).toBe('2028-02-29')
  })

  it('returns nothing when there is no date', () => {
    expect(findExpirationDate('Тушенка говяжья')).toBeUndefined()
  })
})

describe('pickName', () => {
  it('takes the largest text and keeps a title wrapped over two lines together', () => {
    expect(pickName(WINE_LINES)).toBe('Мускат белый красного камня')
  })

  it('skips the legal boilerplate even when it is the biggest text', () => {
    expect(pickName([{ text: 'Содержит сульфиты', height: 99 }, { text: 'Мускат белый', height: 20 }])).toBe(
      'Мускат белый',
    )
  })

  it('stops before a clearly smaller line', () => {
    expect(
      pickName([
        { text: 'Мускат белый', height: 95 },
        { text: 'Вино ликёрное белое', height: 42 },
      ]),
    ).toBe('Мускат белый')
  })

  it('falls back to text shape when the recognizer reports no sizes', () => {
    expect(pickName(normalizeLines(CANNED_LABEL))).toBe('ГЛАВПРОДУКТ')
  })
})

describe('parseLabel', () => {
  it('reads a wine label end to end', () => {
    const parsed = parseLabel(WINE_LABEL, WINE_LINES)
    expect(parsed).toEqual({
      name: 'Мускат белый красного камня',
      brand: 'Винодельня Массандра, Крым',
      year: 2019,
      volumeMl: 750,
      abv: 16,
      expirationDate: undefined,
      category: 'wine',
    })
  })

  it('reads a tinned-food label end to end', () => {
    const parsed = parseLabel(CANNED_LABEL)
    expect(parsed.name).toBe('ГЛАВПРОДУКТ')
    expect(parsed.expirationDate).toBe('2027-08-14')
    expect(parsed.category).toBeUndefined()
  })
})

describe('reading the rest of the label', () => {
  /** Both bottles exactly as the recognition service returned them, heights and all. */
  const CORTE: OcrLine[] = [
    { text: 'CORTE VECCHIA', height: 56, top: 420 },
    { text: 'PINOT GRIGIO', height: 48, top: 981 },
    { text: 'DELLE VENEZIE', height: 59, top: 999 },
    { text: 'Denominazione di Origine Protetta', height: 52, top: 1017 },
    { text: '2025', height: 11, top: 1078 },
    { text: 'TINAZZI', height: 34, top: 1176 },
  ]
  const MASSANDRA: OcrLine[] = [
    { text: 'ПРОИЗВОДСТВЕННО-АГРАРНОЕ ОБЪЕДИНЕНИЕ', height: 58, top: 311 },
    { text: 'МАССАНДРА', height: 157, top: 342 },
    { text: 'ВИНО РОССИИ', height: 51, top: 812 },
    { text: 'МУСКАТ БЕЛЫЙ', height: 93, top: 808 },
    { text: 'КРАСНОГО КАМНЯ', height: 124, top: 820 },
  ]

  it('takes the producer printed small along the bottom', () => {
    const parsed = parseLabel('', CORTE)
    expect(parsed.name).toBe('CORTE VECCHIA')
    expect(parsed.brand).toBe('TINAZZI')
    expect(parsed.year).toBe(2025)
    expect(parsed.category).toBe('wine')
  })

  it('takes the producer named beside its caption, and the wine below it', () => {
    const parsed = parseLabel('', MASSANDRA)
    expect(parsed.brand).toBe('МАССАНДРА')
    expect(parsed.name).toBe('МУСКАТ БЕЛЫЙ КРАСНОГО КАМНЯ')
    expect(parsed.category).toBe('wine')
  })

  it('reads the caption whose hard sign came back as a soft one', () => {
    // How the service actually returns it: Ъ and Ь are all but the same shape in capitals.
    const misread = MASSANDRA.map((line) => ({ ...line, text: line.text.replace('ОБЪЕД', 'ОБЬЕД') }))
    expect(parseLabel('', misread).brand).toBe('МАССАНДРА')
    expect(parseLabel('', misread).name).toBe('МУСКАТ БЕЛЫЙ КРАСНОГО КАМНЯ')
  })

  it('refuses a two-word line at the foot, which is as likely to be the wine', () => {
    const unnamed = MASSANDRA.filter((line) => !line.text.includes('ОБЪЕДИНЕНИЕ'))
    const parsed = parseLabel('', unnamed)
    expect(parsed.name).toBe('МАССАНДРА')
    expect(parsed.brand).toBeUndefined()
  })

  it('leaves the brand alone when nothing on the label names a producer', () => {
    expect(
      parseLabel('', [
        { text: 'Тушенка говяжья', height: 90, top: 100 },
        { text: 'высший сорт', height: 40, top: 200 },
      ]).brand,
    ).toBeUndefined()
  })
})

describe('appellation wording', () => {
  /** Exactly what the recognition service read off a bottle of Pinot Grigio. */
  const CORTE = ['CORTE VECCHIA', 'PINOT GRIGIO', 'DELLE VENEZIE', 'Denominazione di Origine Protetta', '2025', 'TINAZZI']

  it('never puts the designation of origin in the name', () => {
    for (const line of ['Denominazione di Origine Protetta', 'Appellation Bordeaux Contrôlée', 'DOCG']) {
      expect(pickName([{ text: line, height: 90 }])).toBeUndefined()
    }
  })

  it('takes the title even when a line below it measures marginally taller', () => {
    // Heights and positions exactly as the service reported them for this bottle: the title
    // is set much larger than the region, yet measures 56 against 59.
    const lines: OcrLine[] = [
      { text: 'CORTE VECCHIA', height: 56, top: 420 },
      { text: 'PINOT GRIGIO', height: 48, top: 981 },
      { text: 'DELLE VENEZIE', height: 59, top: 999 },
      { text: 'Denominazione di Origine Protetta', height: 52, top: 1017 },
      { text: '2025', height: 11, top: 1078 },
      { text: 'TINAZZI', height: 34, top: 1176 },
    ]
    expect(pickName(lines)).toBe('CORTE VECCHIA')
  })

  it('still joins a title that wrapped onto the next line', () => {
    expect(
      pickName([
        { text: 'Мускат белый', height: 95, top: 600 },
        { text: 'красного камня', height: 68, top: 700 },
        { text: 'Вино ликёрное белое', height: 42, top: 900 },
      ]),
    ).toBe('Мускат белый красного камня')
  })

  it('still prefers a genuinely larger line further down', () => {
    expect(
      pickName([
        { text: 'Винодельческое хозяйство', height: 30, top: 10 },
        { text: 'Мускат белый', height: 95, top: 200 },
      ]),
    ).toBe('Мускат белый')
  })

  it('reads the vintage off the same label', () => {
    expect(findYear(CORTE.map((text) => ({ text, height: 40 })))).toBe(2025)
  })
})

describe('confidence gating', () => {
  /** What the recognizer actually returned for an ornate label on a dark, curved bottle. */
  const GUESSWORK: OcrLine[] = [
    { text: 'ОСВОДСТВЕННО-АГРАРН Е ОБЪЕДИНЕНИЕ', height: 28, confidence: 40 },
    { text: 'М ССАНДР: | » fonds yo Tue', height: 61, confidence: 11 },
    { text: 'ШОКАТ БЕЛЫЙ медь', height: 44, confidence: 0 },
    { text: 'НОГо КАМ!', height: 46, confidence: 46 },
  ]

  it('fills nothing when every line is guesswork', () => {
    expect(parseLabel('', GUESSWORK)).toEqual({
      name: undefined,
      brand: undefined,
      year: undefined,
      volumeMl: undefined,
      abv: undefined,
      expirationDate: undefined,
    })
  })

  it('still reads a label the recognizer was sure about', () => {
    const confident = WINE_LINES.map((line) => ({ ...line, confidence: 93 }))
    expect(parseLabel(WINE_LABEL, confident).name).toBe('Мускат белый красного камня')
  })

  it('ignores a misread year and volume mixed in among good lines', () => {
    const parsed = parseLabel('', [
      { text: 'Мускат белый', height: 95, confidence: 92 },
      { text: '2019', height: 65, confidence: 91 },
      { text: '1899 0,75 л', height: 30, confidence: 12 },
    ])
    expect(parsed.year).toBe(2019)
    expect(parsed.volumeMl).toBeUndefined()
  })

  it('trusts plain text, which carries no confidence at all', () => {
    expect(parseLabel(WINE_LABEL).name).toBeDefined()
  })
})

describe('toProductDraft', () => {
  it('keeps vintages apart by putting the year in the name', () => {
    const draft = toProductDraft({ name: 'Мускат белый', year: 2019 }, 'wine')
    expect(draft.name).toBe('Мускат белый, 2019')
    expect(draft.manufactureDate).toBe('2019-01-01')
  })

  it('leaves non-wine names alone', () => {
    const draft = toProductDraft({ name: 'Тушенка говяжья', year: 2024 }, 'canned_food')
    expect(draft.name).toBe('Тушенка говяжья')
  })

  it('omits fields the label did not provide', () => {
    expect(toProductDraft({ name: 'Вино' }, 'wine')).toEqual({ name: 'Вино' })
  })
})
