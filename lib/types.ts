export interface WindowInfo {
    id: number
    title: string
    appName: string
    pid: number
    x: number
    y: number
    width: number
    height: number
}

export interface CaptureResult {
    image: Buffer
    window: WindowInfo
}

export interface BBox {
    x0: number
    y0: number
    x1: number
    y1: number
}

export interface WordBlock {
    text: string
    bbox: BBox
    confidence: number
}

export interface LineBlock {
    text: string
    bbox: BBox
    confidence: number
}

export interface OcrResult {
    text: string
    confidence: number
    blocks: WordBlock[]
    lines: LineBlock[]
}

export interface OcrOptions {
    lang?: string
    scale?: number
}

export type MouseButton = 'left' | 'right' | 'middle'

export interface MatchEvent {
    ruleName: string
    result: OcrResult
    matchedBlocks: LineBlock[]
    screenOffset: { x: number; y: number }
    window: WindowInfo
}

export interface RuleAction {
    (event: MatchEvent): Promise<void> | void
}

export interface Rule {
    name: string
    when: string | RegExp | { text: string | RegExp }
    action: RuleAction
}

export interface WatcherConfig {
    target: { title?: string; handle?: number }
    interval: number
    rules: Rule[]
    ocrOptions?: OcrOptions
    onError?: (error: Error) => void
}

export interface WatcherStatus {
    running: boolean
    target: string | number
    intervals: number
    lastScan: Date | null
}
