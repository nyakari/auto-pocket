export { listWindows, captureWindow, captureScreen, findWindowsByTitle } from './capture'
export { ocrImage, terminateOcr } from './ocr'
export {
    clickAt,
    doubleClickAt,
    typeText,
    pressKey,
    releaseKey,
    moveMouse,
    getCursorPos,
    Button,
    Key,
} from './actions'
export { Watcher, toScreenCoords } from './watcher'

export type { WindowInfo, CaptureResult } from './types'
export type { BBox, WordBlock, LineBlock, OcrResult, OcrOptions } from './types'
export type {
    MouseButton,
    MatchEvent,
    RuleAction,
    Rule,
    WatcherConfig,
    WatcherStatus,
} from './types'
