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
    ocrImageWithLang: (base64: string, lang: string, scale?: number) => Promise<any>
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

    runWorkflow: (workflow: any, config: any, startIndex?: number, runId?: number) => Promise<void>
    stopWorkflow: () => Promise<void>
    onWorkflowStep: (cb: (data: any) => void) => () => void
    onWorkflowDone: (cb: (data: any) => void) => () => void
    onWorkflowProgress: (cb: (data: any) => void) => () => void
    getDeviceResolution: (adbPath?: string) => Promise<{ width: number; height: number }>
    selectAdb: () => Promise<string | null>
    clearPersistentVars: () => Promise<void>
    resizeWindow: (handle: number, width: number, height: number) => Promise<void>
}

interface Window {
    api: Api
}
