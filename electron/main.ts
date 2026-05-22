import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import {
    listWindows,
    captureWindow,
    ocrImage,
    clickAt,
    typeText,
    findWindowsByTitle,
} from '../dist/index'
import type { SavedConfig } from './types'
import type { LineBlock } from '../dist/index'

let mainWindow: BrowserWindow | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let lastConfig: SavedConfig | null = null

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev')

function getConfigPath(): string {
    const userData = app.getPath('userData')
    return path.join(userData, 'config.json')
}

function loadConfig(): SavedConfig {
    try {
        const raw = fs.readFileSync(getConfigPath(), 'utf-8')
        return JSON.parse(raw)
    } catch {
        return { targetWindowTitle: '', pollInterval: 2000, ocrLang: 'eng', rules: [] }
    }
}

function saveConfig(config: SavedConfig): void {
    console.log(getConfigPath())
    const dir = path.dirname(getConfigPath())
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2))
}

function send(channel: string, data: any) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data)
    }
}

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: 'Auto Pocket',
    })

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173')
        mainWindow.webContents.openDevTools()
    } else {
        mainWindow.loadFile(path.join(__dirname, '../src/dist/index.html'))
    }

    mainWindow.on('closed', () => {
        mainWindow = null
    })
}

function matchLine(lines: LineBlock[], pattern: string): LineBlock[] {
    const lower = pattern.toLowerCase()
    return lines.filter((l) => l.text.toLowerCase().includes(lower))
}

async function pollCycle(config: SavedConfig): Promise<void> {
    try {
        const wins = findWindowsByTitle(config.targetWindowTitle)
        if (wins.length === 0) return

        const capture = await captureWindow(wins[0].id)
        const ocr = await ocrImage(capture.image, { lang: config.ocrLang || 'eng' })

        const b64 = capture.image.toString('base64')
        send('watcher:capture', {
            image: b64,
            windowTitle: capture.window.title,
            ocr: { text: ocr.text, lines: ocr.lines },
        })

        for (const rule of config.rules || []) {
            if (!rule.when) continue
            const matched = matchLine(ocr.lines, rule.when)
            if (matched.length === 0) continue

            send('watcher:match', {
                ruleName: rule.name,
                matchedText: matched[0].text,
                screenOffset: { x: capture.window.x, y: capture.window.y },
                blocks: matched.map((b) => ({ text: b.text, bbox: b.bbox })),
            })

            const cx = capture.window.x + Math.round((matched[0].bbox.x0 + matched[0].bbox.x1) / 2)
            const cy = capture.window.y + Math.round((matched[0].bbox.y0 + matched[0].bbox.y1) / 2)

            switch (rule.action) {
                case 'click':
                    await clickAt(cx, cy)
                    break
                case 'doubleclick':
                    await clickAt(cx, cy)
                    await clickAt(cx, cy)
                    break
                case 'type':
                    await typeText(rule.actionText || '')
                    break
            }
        }
    } catch (err) {
        send('watcher:error', err instanceof Error ? err.message : String(err))
    }
}

function startWatcher(config: SavedConfig): void {
    stopWatcher()
    if (!config.targetWindowTitle) return

    lastConfig = config
    const interval = Math.max(500, config.pollInterval || 2000)

    pollCycle(config)
    pollTimer = setInterval(() => {
        if (lastConfig) pollCycle(lastConfig)
    }, interval)

    send('watcher:status', { running: true })
}

function stopWatcher(): void {
    if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
    }
    send('watcher:status', { running: false })
}

app.whenReady().then(() => {
    createWindow()

    ipcMain.handle('list-windows', () => listWindows())

    ipcMain.handle('capture-window', async (_e, handle: number) => {
        const result = await captureWindow(handle)
        return { image: result.image.toString('base64'), window: result.window }
    })

    ipcMain.handle('ocr-image', async (_e, base64: string) => {
        return ocrImage(Buffer.from(base64, 'base64'))
    })

    ipcMain.handle('ocr-image-with-lang', async (_e, base64: string, lang: string) => {
        return ocrImage(Buffer.from(base64, 'base64'), { lang })
    })

    ipcMain.handle('click-at', async (_e, x: number, y: number, button?: string) => {
        await clickAt(x, y, (button as any) || 'left')
    })

    ipcMain.handle('type-text', async (_e, text: string) => {
        await typeText(text)
    })

    ipcMain.handle('save-config', async (_e, config: SavedConfig) => {
        saveConfig(config)
    })

    ipcMain.handle('load-config', async () => loadConfig())

    ipcMain.handle('start-watcher', async (_e, config: SavedConfig) => {
        startWatcher(config)
    })

    ipcMain.handle('stop-watcher', async () => {
        stopWatcher()
    })

    ipcMain.handle('get-watcher-status', async () => ({
        running: pollTimer !== null,
    }))

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    stopWatcher()
    if (process.platform !== 'darwin') app.quit()
})
