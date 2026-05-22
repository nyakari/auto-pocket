import { createWorker } from 'tesseract.js'
import type { OcrResult, OcrOptions, WordBlock, LineBlock } from './types'

let worker: Awaited<ReturnType<typeof createWorker>> | null = null
let currentLang = 'eng'

async function getWorker(options?: OcrOptions) {
  const lang = options?.lang || 'eng'
  if (!worker) {
    worker = await createWorker(lang)
    currentLang = lang
  } else if (lang !== currentLang) {
    await worker.reinitialize(lang)
    currentLang = lang
  }
  return worker
}

export async function ocrImage(image: Buffer, options?: OcrOptions): Promise<OcrResult> {
  const w = await getWorker(options)
  const { data } = await w.recognize(image, undefined, { blocks: true })

  const lines: LineBlock[] = []
  const blocks: WordBlock[] = []

  if (data.blocks) {
    for (const block of data.blocks) {
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          const trimmed = line.text.trim()
          if (trimmed.length > 0) {
            lines.push({
              text: trimmed,
              bbox: line.bbox,
              confidence: line.confidence,
            })
          }
          for (const word of line.words) {
            const wt = word.text.trim()
            if (wt.length > 0) {
              blocks.push({
                text: wt,
                bbox: word.bbox,
                confidence: word.confidence,
              })
            }
          }
        }
      }
    }
  }

  return {
    text: data.text.trim(),
    confidence: data.confidence,
    blocks,
    lines,
  }
}

export async function terminateOcr(): Promise<void> {
  if (worker) {
    await worker.terminate()
    worker = null
  }
}
