import type { OcrLine } from './parseLabel'

const ENDPOINT = 'https://api.ocr.space/parse/image'

/** The free tier rejects anything larger, and a label needs nowhere near it. */
const MAX_SIDE = 1600
const JPEG_QUALITY = 0.82

interface ServiceWord {
  Height: number
}

interface ServiceLine {
  LineText: string
  MaxHeight: number
  MinTop?: number
  Words?: ServiceWord[]
}

interface ServiceResult {
  ParsedText?: string
  TextOverlay?: { Lines?: ServiceLine[] }
}

interface ServiceResponse {
  ParsedResults?: ServiceResult[]
  IsErroredOnProcessing?: boolean
  ErrorMessage?: string | string[]
  OCRExitCode?: number
}

const shrink = async (image: Blob): Promise<Blob> => {
  // Phones record the camera's rotation as a tag rather than rotating the pixels, so without
  // this the recogniser is handed a photo lying on its side.
  const bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const context = canvas.getContext('2d')
  if (!context) return image
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? image), 'image/jpeg', JPEG_QUALITY)
  })
}

const describeError = (body: ServiceResponse): string => {
  const message = Array.isArray(body.ErrorMessage) ? body.ErrorMessage.join(' ') : body.ErrorMessage
  return message?.trim() || 'Сервис распознавания вернул ошибку.'
}

/**
 * Reads the label through a recognition service. It copes with glare, ribbed paper, curved
 * bottles and ornate type that defeat the on-device reader, at the cost of sending the photo
 * off the device — which is why it only runs when a key has been configured.
 */
export const recognizeViaService = async (image: Blob, apiKey: string): Promise<{ text: string; lines: OcrLine[] }> => {
  const form = new FormData()
  form.append('file', await shrink(image), 'label.jpg')
  // Engine 2 reads Latin and Cyrillic without being told which to expect.
  form.append('OCREngine', '2')
  form.append('scale', 'true')
  form.append('isOverlayRequired', 'true')

  const response = await fetch(ENDPOINT, { method: 'POST', headers: { apikey: apiKey }, body: form })
  if (!response.ok) throw new Error(`Сервис распознавания недоступен (${response.status}).`)

  const body = (await response.json()) as ServiceResponse
  if (body.IsErroredOnProcessing) throw new Error(describeError(body))

  const result = body.ParsedResults?.[0]
  const lines: OcrLine[] = (result?.TextOverlay?.Lines ?? [])
    .map((line) => ({
      text: line.LineText.replace(/\s+/g, ' ').trim(),
      height: line.MaxHeight || Math.max(0, ...(line.Words ?? []).map((word) => word.Height)),
      top: line.MinTop,
    }))
    .filter((line) => line.text.length > 0)

  return { text: result?.ParsedText?.trim() ?? lines.map((line) => line.text).join('\n'), lines }
}
