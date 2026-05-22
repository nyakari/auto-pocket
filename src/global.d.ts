/// <reference types="vite-plus/client" />

declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    const component: DefineComponent<{}, {}, any>
    export default component
}

interface Api {
    listWindows: () => Promise<any[]>
    captureWindow: (handle: number) => Promise<{ image: string; window: any }>
    ocrImage: (base64: string) => Promise<any>
    ocrImageWithLang: (base64: string, lang: string) => Promise<any>
    clickAt: (x: number, y: number, button?: string) => Promise<void>
    typeText: (text: string) => Promise<void>
    saveConfig: (config: any) => Promise<void>
    loadConfig: () => Promise<any>
    startWatcher: (config: any) => Promise<void>
    stopWatcher: () => Promise<void>
    getWatcherStatus: () => Promise<{ running: boolean }>
    onWatcherCapture: (cb: (data: any) => void) => () => void
    onWatcherMatch: (cb: (data: any) => void) => () => void
    onWatcherError: (cb: (msg: string) => void) => () => void
    onWatcherStatus: (cb: (status: { running: boolean }) => void) => () => void
}

declare global {
    interface Window {
        api: Api
    }
}
