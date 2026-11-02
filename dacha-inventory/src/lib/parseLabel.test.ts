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
  { text: 'Мускат белый', height: 95 },
  { text: 'красного камня', height: 90 },
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
    })
  })

  it('reads a tinned-food label end to end', () => {
    const parsed = parseLabel(CANNED_LABEL)
    expect(parsed.name).toBe('ГЛАВПРОДУКТ')
    expect(parsed.expirationDate).toBe('2027-08-14')
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
