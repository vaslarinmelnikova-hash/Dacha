import { recognizeViaService } from './cloudOcr'
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
 * Share of the darkest and brightest pixels excluded when measuring the range to stretch.
 * Dark glass and a blown-out highlight otherwise pin the range at 0…255, where stretching
 * is arithmetically identical to leaving the photo alone.
 */
const CLIP = 0.02

/**
 * Grayscale + contrast stretch at a fixed size. Tesseract is far more accurate on flat,
 * high-contrast input than on a raw phone photo of a glossy bottle.
 */
const preprocess = async (image: Blob): Promise<Blob> => {
  // Phones record the camera's rotation as a tag rather than rotating the pixels, so without
  // this the recogniser is handed a photo lying on its side.
  const bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' })
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

  const histogram = new Uint32Array(256)
  for (let i = 0; i < luminance.length; i++) {
    const value = (pixels[i * 4] * 299 + pixels[i * 4 + 1] * 587 + pixels[i * 4 + 2] * 114) / 1000
    luminance[i] = value
    histogram[luminance[i]]++
  }

  const percentile = (share: number): number => {
    const target = luminance.length * share
    let seen = 0
    for (let level = 0; level < 256; level++) {
      seen += histogram[level]
      if (seen >= target) return level
    }
    return 255
  }

  const min = percentile(CLIP)
  const span = Math.max(1, percentile(1 - CLIP) - min)
  for (let i = 0; i < luminance.length; i++) {
    const stretched = Math.min(255, Math.max(0, ((luminance[i] - min) / span) * 255))
    pixels[i * 4] = stretched
    pixels[i * 4 + 1] = stretched
    pixels[i * 4 + 2] = stretched
  }
  context.putImageData(frame, 0, 0)

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? image), 'image/png')
  })
}

const serviceKey = import.meta.env.VITE_OCR_API_KEY?.trim()

/**
 * Reads the label, through the recognition service when one is configured and on the device
 * otherwise. Measured on two real bottle photos, the on-device reader managed one word in
 * eight on a flat printed label and none at all on an ornate one, while the service read both
 * in full — so the service is tried first, with the device as the fallback when it is
 * unreachable.
 */
export const recognizeLabel = async (
  image: Blob,
  onProgress: (progress: OcrProgress) => void,
): Promise<OcrResult> => {
  if (serviceKey) {
    onProgress({ stage: 'reading', value: 0.3 })
    try {
      const result = await recognizeViaService(image, serviceKey)
      onProgress({ stage: 'reading', value: 1 })
      if (result.lines.length > 0) return result
    } catch (error) {
      console.error('Label service failed, falling back to on-device recognition:', error)
    }
  }
  return recognizeOnDevice(image, onProgress)
}

/**
 * Reads the label text on the device. The recognizer itself is loaded on demand, and the
 * Russian and English models are fetched from the CDN on first use (~15 MB) and then cached
 * by the browser, so only the first scan is slow.
 */
const recognizeOnDevice = async (
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
      .map((line) => ({
        text: line.text.replace(/\s+/g, ' ').trim(),
        height: line.bbox.y1 - line.bbox.y0,
        top: line.bbox.y0,
        confidence: line.confidence,
      }))
      .filter((line) => line.text.length > 0)

    return { text: data.text, lines }
  } finally {
    await worker.terminate()
  }
}
