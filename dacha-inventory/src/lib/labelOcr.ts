import type { OcrLine } from './parseLabel'

export type OcrStage = 'preparing' | 'reading'

export interface OcrProgress {
  stage: OcrStage
  /** 0…1 within the current stage. */
  value: number
}

export interface OcrResult {
  text: string
  lines: OcrLine[]
}

const TARGET_SIDE = 1600

/**
 * Grayscale + contrast stretch at a fixed size. Tesseract is far more accurate on flat,
 * high-contrast input than on a raw phone photo of a glossy bottle.
 */
const preprocess = async (image: Blob): Promise<Blob> => {
  const bitmap = await createImageBitmap(image)
  const scale = TARGET_SIDE / Math.max(bitmap.width, bitmap.height)
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return image

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const frame = context.getImageData(0, 0, width, height)
  const pixels = frame.data
  const luminance = new Uint8ClampedArray(pixels.length / 4)

  let min = 255
  let max = 0
  for (let i = 0; i < luminance.length; i++) {
    const value = (pixels[i * 4] * 299 + pixels[i * 4 + 1] * 587 + pixels[i * 4 + 2] * 114) / 1000
    luminance[i] = value
    if (value < min) min = value
    if (value > max) max = value
  }

  const span = Math.max(1, max - min)
  for (let i = 0; i < luminance.length; i++) {
    const stretched = ((luminance[i] - min) / span) * 255
    pixels[i * 4] = stretched
    pixels[i * 4 + 1] = stretched
    pixels[i * 4 + 2] = stretched
  }
  context.putImageData(frame, 0, 0)

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? image), 'image/png')
  })
}

/**
 * Reads the label text on the device. The recognizer itself is loaded on demand, and the
 * Russian and English models are fetched from the CDN on first use (~15 MB) and then cached
 * by the browser, so only the first scan is slow.
 */
export const recognizeLabel = async (
  image: Blob,
  onProgress: (progress: OcrProgress) => void,
): Promise<OcrResult> => {
  const { createWorker } = await import('tesseract.js')

  const worker = await createWorker(['rus', 'eng'], 1, {
    logger: (message) => {
      if (message.status === 'recognizing text') onProgress({ stage: 'reading', value: message.progress })
      else onProgress({ stage: 'preparing', value: message.progress })
    },
  })

  try {
    const { data } = await worker.recognize(await preprocess(image), {}, { blocks: true, text: true })
    const lines: OcrLine[] = (data.blocks ?? [])
      .flatMap((block) => block.paragraphs)
      .flatMap((paragraph) => paragraph.lines)
      .map((line) => ({ text: line.text.replace(/\s+/g, ' ').trim(), height: line.bbox.y1 - line.bbox.y0 }))
      .filter((line) => line.text.length > 0)

    return { text: data.text, lines }
  } finally {
    await worker.terminate()
  }
}
