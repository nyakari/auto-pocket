import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { recognizeBatchFromPath } from 'node-windows-ocr'
import type { OCRResult } from 'node-windows-ocr'
import type { OcrResult, OcrOptions, WordBlock, LineBlock } from './types'

const TESSERACT_TO_BCP47: Record<string, string> = {
    eng: 'en-US',
    jpn: 'ja-JP',
    kor: 'ko-KR',
    chi_sim: 'zh-CN',
    deu: 'de-DE',
    fra: 'fr-FR',
}

function normalizeLang(lang: string): string {
    return TESSERACT_TO_BCP47[lang] || lang
}

function toBBox(r: OCRResult['Result']['Lines'][0]['Words'][0]['BoundingRect']) {
    return { x0: r.Left, y0: r.Top, x1: r.Right, y1: r.Bottom }
}

export async function ocrImage(image: Buffer, options?: OcrOptions): Promise<OcrResult> {
    const lang = normalizeLang(options?.lang || 'en-US')

    const tmpFile = join(tmpdir(), `auto-pocket-ocr-${randomUUID()}.png`)
    await writeFile(tmpFile, image)

    try {
        let moduleRoot: string | undefined = undefined
        const currentDir = __dirname
        const asarIdx = currentDir.toLowerCase().indexOf('app.asar')
        if (asarIdx !== -1) {
            const appAsarPath = currentDir.substring(0, asarIdx + 8)
            const unpackedPath = appAsarPath.replace(/app\.asar/i, 'app.asar.unpacked')
            moduleRoot = join(unpackedPath, 'node_modules', 'node-windows-ocr')
        }

        const [raw] = await recognizeBatchFromPath([tmpFile], {
            language: lang,
            moduleRoot,
        })

        const lines: LineBlock[] = []
        const blocks: WordBlock[] = []

        for (const line of raw.Result.Lines) {
            const lineText = line.Text.trim()
            if (!lineText) continue

            const words: WordBlock[] = []
            let x0 = Infinity,
                y0 = Infinity,
                x1 = -Infinity,
                y1 = -Infinity

            for (const word of line.Words) {
                const wt = word.Text.trim()
                if (!wt) continue
                const b = toBBox(word.BoundingRect)
                words.push({ text: wt, bbox: b, confidence: 1.0 })
                if (b.x0 < x0) x0 = b.x0
                if (b.y0 < y0) y0 = b.y0
                if (b.x1 > x1) x1 = b.x1
                if (b.y1 > y1) y1 = b.y1
            }

            blocks.push(...words)

            if (words.length > 0) {
                lines.push({
                    text: lineText,
                    bbox: { x0, y0, x1, y1 },
                    confidence: 1.0,
                })
            }
        }

        return {
            text: raw.Result.Text.trim(),
            confidence: 1.0,
            blocks,
            lines,
        }
    } finally {
        unlink(tmpFile).catch(() => {})
    }
}

export async function terminateOcr(): Promise<void> {}
