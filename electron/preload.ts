import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
    listWindows: () => ipcRenderer.invoke('list-windows'),
    captureWindow: (handle: number) => ipcRenderer.invoke('capture-window', handle),
    ocrImage: (base64: string) => ipcRenderer.invoke('ocr-image', base64),
    ocrImageWithLang: (base64: string, lang: string) =>
        ipcRenderer.invoke('ocr-image-with-lang', base64, lang),
    clickAt: (x: number, y: number, button?: string) =>
        ipcRenderer.invoke('click-at', x, y, button),
    typeText: (text: string) => ipcRenderer.invoke('type-text', text),
    saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
    loadConfig: () => ipcRenderer.invoke('load-config'),
    startWatcher: (config: any) => ipcRenderer.invoke('start-watcher', config),
    stopWatcher: () => ipcRenderer.invoke('stop-watcher'),
    getWatcherStatus: () => ipcRenderer.invoke('get-watcher-status'),

    onWatcherCapture: (cb: (data: any) => void) => {
        const handler = (_e: any, data: any) => cb(data)
        ipcRenderer.on('watcher:capture', handler)
        return () => ipcRenderer.removeListener('watcher:capture', handler)
    },
    onWatcherMatch: (cb: (data: any) => void) => {
        const handler = (_e: any, data: any) => cb(data)
        ipcRenderer.on('watcher:match', handler)
        return () => ipcRenderer.removeListener('watcher:match', handler)
    },
    onWatcherError: (cb: (msg: string) => void) => {
        const handler = (_e: any, msg: string) => cb(msg)
        ipcRenderer.on('watcher:error', handler)
        return () => ipcRenderer.removeListener('watcher:error', handler)
    },
    onWatcherStatus: (cb: (status: any) => void) => {
        const handler = (_e: any, status: any) => cb(status)
        ipcRenderer.on('watcher:status', handler)
        return () => ipcRenderer.removeListener('watcher:status', handler)
    },
})
