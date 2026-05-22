export interface SavedConfig {
    targetWindowTitle: string
    pollInterval: number
    ocrLang: string
    rules: SavedRule[]
}

export interface SavedRule {
    name: string
    when: string
    action: string
    actionText?: string
}

export interface WatcherMatchEvent {
    ruleName: string
    matchedText: string
    screenOffset: { x: number; y: number }
    blocks: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }>
}
