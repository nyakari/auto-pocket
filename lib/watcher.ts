import { captureWindow, findWindowsByTitle } from './capture'
import { ocrImage } from './ocr'
import type { WatcherConfig, MatchEvent, LineBlock, WatcherStatus } from './types'

export class Watcher {
    private config: WatcherConfig
    private timer: ReturnType<typeof setInterval> | null = null
    private matchCount = 0
    private lastScan: Date | null = null

    constructor(config: WatcherConfig) {
        this.config = config
    }

    start(): void {
        if (this.timer) return
        void this.poll()
        this.timer = setInterval(() => this.poll(), this.config.interval)
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer)
            this.timer = null
        }
    }

    private async poll(): Promise<void> {
        try {
            let handle = this.config.target.handle
            if (!handle && this.config.target.title) {
                const windows = findWindowsByTitle(this.config.target.title)
                if (windows.length === 0) return
                handle = windows[0].id
            }
            if (!handle) return

            const capture = await captureWindow(handle)
            const result = await ocrImage(capture.image, this.config.ocrOptions)

            this.lastScan = new Date()
            this.matchCount++

            for (const rule of this.config.rules) {
                const matchedBlocks = matchLines(result.lines, rule.when)
                if (matchedBlocks.length > 0) {
                    const event: MatchEvent = {
                        ruleName: rule.name,
                        result,
                        matchedBlocks,
                        screenOffset: { x: capture.window.x, y: capture.window.y },
                        window: capture.window,
                    }
                    await rule.action(event)
                }
            }
        } catch (err) {
            this.config.onError?.(err instanceof Error ? err : new Error(String(err)))
        }
    }

    getStatus(): WatcherStatus {
        return {
            running: this.timer !== null,
            target: this.config.target.title ?? this.config.target.handle ?? 'unknown',
            intervals: this.matchCount,
            lastScan: this.lastScan,
        }
    }
}

function matchLines(
    lines: LineBlock[],
    when: string | RegExp | { text: string | RegExp },
): LineBlock[] {
    let pattern: string | RegExp
    if (typeof when === 'string' || when instanceof RegExp) {
        pattern = when
    } else {
        pattern = when.text
    }

    return lines.filter((line) => {
        if (typeof pattern === 'string') {
            return line.text.toLowerCase().includes(pattern.toLowerCase())
        }
        return pattern.test(line.text)
    })
}

export function toScreenCoords(
    bbox: { x0: number; y0: number; x1: number; y1: number },
    offset: { x: number; y: number },
): { x: number; y: number } {
    return {
        x: offset.x + Math.round((bbox.x0 + bbox.x1) / 2),
        y: offset.y + Math.round((bbox.y0 + bbox.y1) / 2),
    }
}
