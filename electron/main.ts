import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import path from 'path'
import fs from 'fs'

process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION:', error)
})
process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason)
})

import { execSync, exec, execFileSync } from 'child_process'
import {
    listWindows,
    captureWindow,
    ocrImage,
    clickAt,
    doubleClickAt,
    typeText,
    findWindowsByTitle,
    drag,
    pressKey,
    releaseKey,
    moveMouse,
} from '../dist/index'
import type {
    SavedConfig,
    Workflow,
    WorkflowStepEvent,
    WorkflowResult,
    WorkflowProgress,
} from './types'
import type { LineBlock } from '../dist/index'
import { Key } from '@nut-tree-fork/nut-js'

let mainWindow: BrowserWindow | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let lastConfig: SavedConfig | null = null
let workflowAbort: boolean = false
const workflowVars: Map<string, string> = new Map()

function getNutKey(k: string): any {
    const map: Record<string, any> = {
        Enter: Key.Enter,
        Escape: Key.Escape,
        Tab: Key.Tab,
        Backspace: Key.Backspace,
        Space: Key.Space,
        ArrowUp: Key.Up,
        ArrowDown: Key.Down,
        ArrowLeft: Key.Left,
        ArrowRight: Key.Right,
        Home: Key.Home,
        End: Key.End,
        PageUp: Key.PageUp,
        PageDown: Key.PageDown,
        Delete: Key.Delete,
        Insert: Key.Insert,
        ctrl: Key.LeftControl,
        alt: Key.LeftAlt,
        shift: Key.LeftShift,
        win: Key.LeftSuper,
    }
    if (k && k.length === 1) {
        const char = k.toUpperCase()
        const keyName = `V` + char
        if ((Key as any)[keyName] !== undefined) {
            return (Key as any)[keyName]
        }
    }
    return map[k] || (Key as any)[k]
}

function evaluateMathExpression(expr: string, vars: Map<string, string>): number {
    let substituted = expr.replace(/(\w+)/g, (match) => {
        if (vars.has(match)) {
            return vars.get(match) || '0'
        }
        return match
    })
    substituted = substituted.replace(/\$\{(\w+)\}/g, (_, name) => {
        return vars.get(name) || '0'
    })
    const clean = substituted.replace(/\s+/g, '')
    const match = clean.match(/^([+-]?\d+(?:\.\d+)?)(?:([+\-*/])([+-]?\d+(?:\.\d+)?))?$/)
    if (match) {
        const num1 = parseFloat(match[1])
        const op = match[2]
        const num2 = match[3] ? parseFloat(match[3]) : null

        if (op && num2 !== null) {
            switch (op) {
                case '+':
                    return num1 + num2
                case '-':
                    return num1 - num2
                case '*':
                    return num1 * num2
                case '/':
                    return num2 !== 0 ? num1 / num2 : 0
            }
        }
        return num1
    }
    return 0
}

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev')

function getConfigPath(): string {
    const userData = app.getPath('userData')
    return path.join(userData, 'config.json')
}

function getPersistentVarsPath(): string {
    const userData = app.getPath('userData')
    return path.join(userData, 'persistent-vars.json')
}

function loadPersistentVars(): Map<string, string> {
    try {
        const raw = fs.readFileSync(getPersistentVarsPath(), 'utf-8')
        const obj = JSON.parse(raw)
        const map = new Map<string, string>()
        for (const [k, v] of Object.entries(obj)) {
            map.set(k, String(v))
        }
        return map
    } catch {
        return new Map()
    }
}

function savePersistentVars(vars: Map<string, string>): void {
    const obj: Record<string, string> = {}
    vars.forEach((v, k) => {
        obj[k] = v
    })
    fs.writeFileSync(getPersistentVarsPath(), JSON.stringify(obj, null, 2))
}

function getWindowDpiScale(handle: number): number {
    const psCommand = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll", SetLastError = true)]
  public static extern uint GetDpiForWindow(IntPtr hwnd);
}
"@
$dpi = [Win32]::GetDpiForWindow([IntPtr]${handle})
if ($dpi -eq 0) { $dpi = 96 }
$dpi
`
    try {
        const out = execFileSync('powershell', ['-Command', psCommand], {
            timeout: 2000,
            encoding: 'utf-8',
        }).trim()
        const dpi = parseInt(out, 10) || 96
        return dpi / 96
    } catch (e: any) {
        console.error(`[window] Failed to get window DPI scale: ${e.message}`)
        return 1.0
    }
}

function loadConfig(): SavedConfig {
    try {
        const raw = fs.readFileSync(getConfigPath(), 'utf-8')
        const c = JSON.parse(raw)
        return {
            targetWindowTitle: c.targetWindowTitle || '',
            pollInterval: c.pollInterval || 2000,
            ocrLang: c.ocrLang || 'en-US',
            rules: c.rules || [],
            workflows: c.workflows || [],
            defaultWaitMs: c.defaultWaitMs || 500,
            useScrcpy: c.useScrcpy ?? false,
            deviceResolution: c.deviceResolution || { width: 0, height: 0 },
            adbPath: c.adbPath || 'adb',
        }
    } catch {
        return {
            targetWindowTitle: '',
            pollInterval: 2000,
            ocrLang: 'en-US',
            rules: [],
            workflows: [],
            defaultWaitMs: 500,
            useScrcpy: false,
            deviceResolution: { width: 0, height: 0 },
            adbPath: 'adb',
        }
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
    Menu.setApplicationMenu(null)
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: 'Auto Pocket',
    })

    if (isDev) {
        void mainWindow.loadURL('http://localhost:5173')
        mainWindow.webContents.openDevTools()
    } else {
        void mainWindow.loadFile(path.join(__dirname, '../src/dist/index.html'))
    }

    mainWindow.on('closed', () => {
        mainWindow = null
    })

    mainWindow.on('maximize', () => {
        mainWindow?.webContents.send('window:maximized', true)
    })

    mainWindow.on('unmaximize', () => {
        mainWindow?.webContents.send('window:maximized', false)
    })
}

function matchLine(lines: LineBlock[], pattern: string, useRegex?: boolean): LineBlock[] {
    if (useRegex) {
        try {
            const re = new RegExp(pattern, 'i')
            return lines.filter((l) => re.test(l.text))
        } catch {
            return []
        }
    }
    const lower = pattern.toLowerCase()
    return lines.filter((l) => l.text.toLowerCase().includes(lower))
}

async function pollCycle(config: SavedConfig): Promise<void> {
    try {
        const wins = findWindowsByTitle(config.targetWindowTitle)
        if (wins.length === 0) return

        const capture = await captureWindow(wins[0].id)
        const ocr = await ocrImage(capture.image, {
            lang: config.ocrLang || 'en-US',
        })

        const b64 = capture.image.toString('base64')
        send('watcher:capture', {
            image: b64,
            windowTitle: capture.window.title,
            ocr: { text: ocr.text, lines: ocr.lines },
        })

        for (const rule of config.rules || []) {
            if (!rule.when) continue
            const matched = matchLine(ocr.lines, rule.when, rule.useRegex)
            if (matched.length === 0) continue

            send('watcher:match', {
                ruleName: rule.name,
                matchedText: matched[0].text,
                screenOffset: { x: capture.window.x, y: capture.window.y },
                blocks: matched.map((b) => ({ text: b.text, bbox: b.bbox })),
            })

            const dpiScale = getWindowDpiScale(wins[0].id)
            const cx =
                capture.window.x +
                Math.round((matched[0].bbox.x0 + matched[0].bbox.x1) / 2 / dpiScale)
            const cy =
                capture.window.y +
                Math.round((matched[0].bbox.y0 + matched[0].bbox.y1) / 2 / dpiScale)

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

    void pollCycle(config)
    pollTimer = setInterval(() => {
        if (lastConfig) void pollCycle(lastConfig)
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

async function runWorkflow(
    workflow: Workflow,
    config: SavedConfig,
    startIndex: number = 0,
    runId: number = 0,
): Promise<void> {
    workflowAbort = false
    workflowVars.clear()
    const repeatCounters: Map<string, number> = new Map()

    // Load persistent variables from disk so they survive across runs
    const persistentVars = loadPersistentVars()
    persistentVars.forEach((v, k) => workflowVars.set(k, v))

    // Find target window once to reuse its position for mouse-mode clicks
    const wins = findWindowsByTitle(config.targetWindowTitle)
    const windowPos = wins.length > 0 ? { x: wins[0].x, y: wins[0].y } : undefined
    const dpiScale = wins.length > 0 ? getWindowDpiScale(wins[0].id) : 1.0

    console.log(`[workflow] startIndex=${startIndex}, total steps=${workflow.steps.length}`)
    for (let i = startIndex; i < workflow.steps.length; i++) {
        if (workflowAbort) {
            send('workflow:done', {
                workflowName: workflow.name,
                status: 'stopped',
                completedSteps: i,
                totalSteps: workflow.steps.length,
            } satisfies WorkflowResult)
            return
        }

        const step = workflow.steps[i]
        const sendEvent = (
            status: WorkflowStepEvent['status'],
            extra?: Partial<WorkflowStepEvent>,
        ) => {
            send('workflow:step', {
                workflowName: workflow.name,
                stepIndex: i,
                step,
                status,
                ...extra,
            } satisfies WorkflowStepEvent)
        }

        sendEvent('running')

        if (step.waitBeforeMs > 0) {
            await sleepWithProgress(step.waitBeforeMs, i, 'waitBefore', workflow.name, runId)
            if (workflowAbort) continue
        }

        try {
            switch (step.type) {
                case 'clickXY': {
                    const adb = getAdbExe(config)
                    if (config.useScrcpy) {
                        if (step.clickType === 'double') {
                            await adbTap(adb, step.x, step.y)
                            await sleep(150)
                            await adbTap(adb, step.x, step.y)
                            sendEvent('success', {
                                message: `Double-tapped device at (${step.x}, ${step.y})`,
                            })
                        } else {
                            await adbTap(adb, step.x, step.y)
                            sendEvent('success', {
                                message: `Tapped device at (${step.x}, ${step.y})`,
                            })
                        }
                    } else {
                        const sx = Math.round(step.x / dpiScale) + (windowPos?.x ?? 0)
                        const sy = Math.round(step.y / dpiScale) + (windowPos?.y ?? 0)
                        const clickBtn =
                            step.clickType === 'right'
                                ? 'right'
                                : step.clickType === 'middle'
                                  ? 'middle'
                                  : 'left'

                        if (step.clickType === 'double') {
                            await withTimeout(
                                doubleClickAt(sx, sy, 'left'),
                                STEP_ACTION_TIMEOUT,
                                `Double click at (${sx}, ${sy})`,
                            )
                            sendEvent('success', {
                                message: `Double-clicked at screen (${sx}, ${sy})`,
                            })
                        } else {
                            await withTimeout(
                                clickAt(sx, sy, clickBtn),
                                STEP_ACTION_TIMEOUT,
                                `${clickBtn === 'right' ? 'Right clicked' : 'Clicked'} at (${sx}, ${sy})`,
                            )
                            sendEvent('success', {
                                message: `${clickBtn === 'right' ? 'Right-clicked' : 'Clicked'} at screen (${sx}, ${sy})`,
                            })
                        }
                    }
                    break
                }

                case 'callWorkflow': {
                    if (!(step as any).targetWorkflow) {
                        sendEvent('error', { message: 'No target workflow specified' })
                        break
                    }
                    const targetWfName = (step as any).targetWorkflow
                    const targetWf = config.workflows.find((w: any) => w.name === targetWfName)
                    if (!targetWf) {
                        sendEvent('error', {
                            message: `Target workflow "${targetWfName}" not found`,
                        })
                        break
                    }
                    sendEvent('success', { message: `Calling sub-workflow "${targetWfName}"` })
                    await runWorkflow(targetWf, config, 0, runId)
                    if (workflowAbort) break
                    sendEvent('success', {
                        message: `Returned from sub-workflow "${targetWfName}"`,
                    })
                    break
                }

                case 'clickText': {
                    if (!step.when) {
                        sendEvent('error', { message: 'No text pattern specified' })
                        break
                    }
                    const match = await waitForText(
                        config,
                        step.when,
                        step.timeoutMs || 5000,
                        step.matchIndex ?? 0,
                        step.wholeWord ?? false,
                        step.useRegex ?? false,
                        i,
                        workflow.name,
                        runId,
                    )
                    if (workflowAbort) break
                    if (!match) {
                        sendEvent('error', {
                            message: `Text "${step.when}" not found within timeout`,
                        })
                        break
                    }
                    let tx = match.cx
                    let ty = match.cy
                    const adb = getAdbExe(config)
                    if (config.useScrcpy) {
                        const dw = config.deviceResolution.width
                        const dh = config.deviceResolution.height
                        if (dw > 0 && dh > 0 && match.captureWidth > 0 && match.captureHeight > 0) {
                            tx = Math.round(tx * (dw / match.captureWidth))
                            ty = Math.round(ty * (dh / match.captureHeight))
                        }
                        if (step.clickType === 'double') {
                            await adbTap(adb, tx, ty)
                            await sleep(150)
                            await adbTap(adb, tx, ty)
                            sendEvent('success', {
                                message: `Double-tapped "${match.text}" at device (${tx}, ${ty})`,
                                matchedText: match.text,
                                matchedBbox: match.bbox,
                            })
                        } else {
                            await adbTap(adb, tx, ty)
                            sendEvent('success', {
                                message: `Tapped "${match.text}" at device (${tx}, ${ty})`,
                                matchedText: match.text,
                                matchedBbox: match.bbox,
                            })
                        }
                    } else {
                        const sx = Math.round(tx / dpiScale) + match.windowX
                        const sy = Math.round(ty / dpiScale) + match.windowY
                        const clickBtn =
                            step.clickType === 'right'
                                ? 'right'
                                : step.clickType === 'middle'
                                  ? 'middle'
                                  : 'left'

                        if (step.clickType === 'double') {
                            await withTimeout(
                                doubleClickAt(sx, sy, 'left'),
                                STEP_ACTION_TIMEOUT,
                                `Double click "${match.text}" at (${sx}, ${sy})`,
                            )
                            sendEvent('success', {
                                message: `Double-clicked "${match.text}" at screen (${sx}, ${sy})`,
                                matchedText: match.text,
                                matchedBbox: match.bbox,
                            })
                        } else {
                            await withTimeout(
                                clickAt(sx, sy, clickBtn),
                                STEP_ACTION_TIMEOUT,
                                `Click "${match.text}" at (${sx}, ${sy})`,
                            )
                            sendEvent('success', {
                                message: `${clickBtn === 'right' ? 'Right-clicked' : 'Clicked'} "${match.text}" at screen (${sx}, ${sy})`,
                                matchedText: match.text,
                                matchedBbox: match.bbox,
                            })
                        }
                    }
                    break
                }

                case 'waitText': {
                    if (!step.when) {
                        sendEvent('error', { message: 'No text pattern specified' })
                        break
                    }
                    const found = await waitForText(
                        config,
                        step.when,
                        step.timeoutMs || 10000,
                        0,
                        false,
                        step.useRegex ?? false,
                        i,
                        workflow.name,
                        runId,
                    )
                    if (workflowAbort) break
                    if (!found) {
                        sendEvent('error', { message: `Timed out waiting for "${step.when}"` })
                        break
                    }
                    sendEvent('success', {
                        message: `Found "${found.text}"`,
                        matchedText: found.text,
                        matchedBbox: found.bbox,
                    })
                    break
                }

                case 'wait': {
                    const waitDur = step.durationMs || 1000
                    await sleepWithProgress(waitDur, i, 'waitStep', workflow.name, runId)
                    if (workflowAbort) break
                    sendEvent('success', { message: `Waited ${waitDur}ms` })
                    break
                }

                case 'goto': {
                    const gt = (step.targetStep ?? 1) - 1
                    if (gt >= 0 && gt < workflow.steps.length) {
                        i = gt - 1
                        sendEvent('success', { message: `Jumped to step ${gt + 1}` })
                    } else {
                        sendEvent('error', { message: `Invalid target step ${step.targetStep}` })
                    }
                    break
                }

                case 'condition': {
                    if (!step.when) {
                        sendEvent('error', { message: 'No text pattern specified' })
                        break
                    }
                    const condResult = await waitForText(
                        config,
                        step.when,
                        step.timeoutMs || 5000,
                        0,
                        step.wholeWord ?? false,
                        step.useRegex ?? false,
                        i,
                        workflow.name,
                        runId,
                    )
                    if (workflowAbort) break
                    if (condResult) {
                        const ct = (step.thenStep ?? 1) - 1
                        if (ct >= 0 && ct < workflow.steps.length) {
                            i = ct - 1
                            sendEvent('success', {
                                message: `Found "${condResult.text}", jumped to step ${ct + 1}`,
                                matchedText: condResult.text,
                                matchedBbox: condResult.bbox,
                            })
                        } else {
                            sendEvent('error', {
                                message: `Found "${condResult.text}" but invalid target step ${step.thenStep}`,
                                matchedText: condResult.text,
                                matchedBbox: condResult.bbox,
                            })
                        }
                    } else {
                        const et = (step.elseStep ?? 0) - 1
                        if (et >= 0 && et < workflow.steps.length) {
                            i = et - 1
                            sendEvent('success', {
                                message: `Text "${step.when}" not found, jumped to step ${et + 1}`,
                            })
                        } else {
                            sendEvent('success', {
                                message: `Text "${step.when}" not found, continuing`,
                            })
                        }
                    }
                    break
                }

                case 'setVar': {
                    const sv = resolveTemplate(String(step.varValue ?? ''), workflowVars)
                    workflowVars.set(String(step.varName ?? ''), sv)
                    if (step.persist) {
                        const pv = loadPersistentVars()
                        pv.set(String(step.varName ?? ''), sv)
                        savePersistentVars(pv)
                    }
                    sendEvent('success', { message: `Set variable "${step.varName}" = "${sv}"` })
                    break
                }

                case 'checkVar': {
                    const actual = workflowVars.get(String(step.varName ?? ''))
                    const expected = resolveTemplate(String(step.varValue ?? ''), workflowVars)
                    if (actual === expected) {
                        const ct = (step.thenStep ?? 1) - 1
                        if (ct >= 0 && ct < workflow.steps.length) {
                            i = ct - 1
                            sendEvent('success', {
                                message: `Variable "${step.varName}" == "${expected}", jumped to step ${ct + 1}`,
                            })
                        } else {
                            sendEvent('error', {
                                message: `Variable matched but invalid target step ${step.thenStep}`,
                            })
                        }
                    } else {
                        const et = (step.elseStep ?? 0) - 1
                        if (et >= 0 && et < workflow.steps.length) {
                            i = et - 1
                            sendEvent('success', {
                                message: `Variable "${step.varName}" != "${expected}", jumped to step ${et + 1}`,
                            })
                        } else {
                            sendEvent('success', {
                                message: `Variable "${step.varName}" != "${expected}", continuing`,
                            })
                        }
                    }
                    break
                }

                case 'swipe': {
                    const adb = getAdbExe(config)
                    const durMs = Math.round((step.duration || 0.3) * 1000)
                    if (config.useScrcpy) {
                        await adbSwipe(adb, step.x1, step.y1, step.x2, step.y2, durMs)
                        sendEvent('success', {
                            message: `Swiped device (${step.x1},${step.y1}) → (${step.x2},${step.y2}) in ${step.duration || 0.3}s`,
                        })
                    } else {
                        const sx1 = Math.round(step.x1 / dpiScale) + (windowPos?.x ?? 0)
                        const sy1 = Math.round(step.y1 / dpiScale) + (windowPos?.y ?? 0)
                        const sx2 = Math.round(step.x2 / dpiScale) + (windowPos?.x ?? 0)
                        const sy2 = Math.round(step.y2 / dpiScale) + (windowPos?.y ?? 0)
                        await withTimeout(
                            drag(sx1, sy1, sx2, sy2),
                            STEP_ACTION_TIMEOUT,
                            `Drag (${sx1},${sy1})→(${sx2},${sy2})`,
                        )
                        sendEvent('success', {
                            message: `Dragged mouse (${sx1},${sy1}) → (${sx2},${sy2})`,
                        })
                    }
                    break
                }

                case 'countText': {
                    if (!step.when) {
                        sendEvent('error', { message: 'No text pattern specified' })
                        break
                    }
                    try {
                        const wins = findWindowsByTitle(config.targetWindowTitle)
                        if (wins.length === 0) {
                            sendEvent('error', { message: 'Target window not found' })
                            break
                        }
                        const capture = await captureWindow(wins[0].id)
                        const ocr = await ocrImage(capture.image, {
                            lang: config.ocrLang || 'en-US',
                        })
                        const matched = matchBlocks(ocr.blocks, step.when, false, step.useRegex)
                        const count = matched.length
                        workflowVars.set(String(step.varName ?? ''), String(count))
                        sendEvent('success', {
                            message: `Found ${count} match(es) for "${step.when}"`,
                        })
                    } catch (err) {
                        sendEvent('error', {
                            message: err instanceof Error ? err.message : String(err),
                        })
                    }
                    break
                }

                case 'captureLine': {
                    if (!step.when) {
                        sendEvent('error', { message: 'No text pattern specified' })
                        break
                    }
                    try {
                        const wins = findWindowsByTitle(config.targetWindowTitle)
                        if (wins.length === 0) {
                            sendEvent('error', { message: 'Target window not found' })
                            break
                        }
                        const capture = await captureWindow(wins[0].id)
                        const ocr = await ocrImage(capture.image, {
                            lang: config.ocrLang || 'en-US',
                        })
                        const matched = matchBlocks(
                            ocr.blocks,
                            step.when,
                            step.wholeWord ?? false,
                            step.useRegex,
                        )
                        if (matched.length === 0) {
                            sendEvent('error', {
                                message: `No match for "${step.when}"`,
                            })
                            break
                        }
                        let idx = step.matchIndex ?? 0
                        if (idx < 0) idx = matched.length + idx
                        if (idx < 0 || idx >= matched.length) {
                            sendEvent('error', {
                                message: `Match index ${step.matchIndex} out of range (${matched.length} matches)`,
                            })
                            break
                        }
                        const block = matched[idx]
                        // Find the line that contains this block
                        const line = ocr.lines.find((l: any) => {
                            const cx = (block.bbox.x0 + block.bbox.x1) / 2
                            const cy = (block.bbox.y0 + block.bbox.y1) / 2
                            return (
                                cx >= l.bbox.x0 &&
                                cx <= l.bbox.x1 &&
                                cy >= l.bbox.y0 &&
                                cy <= l.bbox.y1
                            )
                        })
                        const lineText = line ? line.text : block.text
                        workflowVars.set(String(step.varName ?? ''), lineText)
                        if (step.persist) {
                            const pv = loadPersistentVars()
                            pv.set(String(step.varName ?? ''), lineText)
                            savePersistentVars(pv)
                        }
                        sendEvent('success', {
                            message: `Captured line "${lineText}"`,
                            matchedText: lineText,
                            matchedBbox: line ? line.bbox : block.bbox,
                        })
                    } catch (err) {
                        sendEvent('error', {
                            message: err instanceof Error ? err.message : String(err),
                        })
                    }
                    break
                }

                case 'pressKey': {
                    const keyVal = getNutKey(step.key || 'Enter')
                    const mods = (step.modifiers || []).map(getNutKey).filter(Boolean)
                    if (config.useScrcpy) {
                        const adb = getAdbExe(config)
                        const adbKeycodeMap: Record<string, number> = {
                            Enter: 66,
                            Escape: 111,
                            Backspace: 67,
                            Tab: 61,
                            Space: 62,
                            ArrowUp: 19,
                            ArrowDown: 20,
                            ArrowLeft: 21,
                            ArrowRight: 22,
                        }
                        const code = adbKeycodeMap[step.key || 'Enter'] || 66
                        await new Promise<void>((resolve, reject) => {
                            exec(
                                `"${adb}" shell input keyevent ${code}`,
                                { timeout: 5000 },
                                (err) => {
                                    if (err)
                                        reject(new Error(`adb keyevent failed: ${err.message}`))
                                    else resolve()
                                },
                            )
                        })
                        sendEvent('success', { message: `Pressed key code ${code} via ADB` })
                    } else {
                        if (mods.length > 0) await pressKey(...mods)
                        if (keyVal) {
                            await pressKey(keyVal)
                            await releaseKey(keyVal)
                        }
                        if (mods.length > 0) await releaseKey(...mods)
                        const msg = `Pressed key: ${step.modifiers && step.modifiers.length ? step.modifiers.join('+') + '+' : ''}${step.key || 'Enter'}`
                        sendEvent('success', { message: msg })
                    }
                    break
                }

                case 'captureImage': {
                    const wins = findWindowsByTitle(config.targetWindowTitle)
                    if (wins.length === 0) {
                        sendEvent('error', { message: 'Target window not found' })
                        break
                    }
                    const capture = await captureWindow(wins[0].id)
                    let folder = step.folderPath
                        ? resolveTemplate(step.folderPath, workflowVars)
                        : ''
                    if (!folder) {
                        folder = app.getPath('downloads')
                    }
                    if (!fs.existsSync(folder)) {
                        fs.mkdirSync(folder, { recursive: true })
                    }
                    let fileName = step.fileName
                        ? resolveTemplate(step.fileName, workflowVars)
                        : 'screenshot_${timestamp}'
                    fileName = fileName.replace(/\$\{timestamp\}/g, String(Date.now()))
                    if (!fileName.endsWith('.png')) fileName += '.png'
                    const fullPath = path.join(folder, fileName)
                    fs.writeFileSync(fullPath, capture.image)
                    sendEvent('success', { message: `Saved screenshot to ${fullPath}` })
                    break
                }

                case 'hoverXY': {
                    if (config.useScrcpy) {
                        sendEvent('success', { message: 'Hover ignored in ADB/scrcpy mode' })
                    } else {
                        const sx = Math.round(step.x / dpiScale) + (windowPos?.x ?? 0)
                        const sy = Math.round(step.y / dpiScale) + (windowPos?.y ?? 0)
                        await withTimeout(
                            moveMouse(sx, sy),
                            STEP_ACTION_TIMEOUT,
                            `Hover at (${sx}, ${sy})`,
                        )
                        sendEvent('success', { message: `Hovered mouse at screen (${sx}, ${sy})` })
                    }
                    break
                }

                case 'hoverText': {
                    if (config.useScrcpy) {
                        sendEvent('success', { message: 'Hover ignored in ADB/scrcpy mode' })
                        break
                    }
                    if (!step.when) {
                        sendEvent('error', { message: 'No text pattern specified' })
                        break
                    }
                    const match = await waitForText(
                        config,
                        step.when,
                        step.timeoutMs || 5000,
                        step.matchIndex ?? 0,
                        step.wholeWord ?? false,
                        step.useRegex ?? false,
                        i,
                        workflow.name,
                        runId,
                    )
                    if (workflowAbort) break
                    if (!match) {
                        sendEvent('error', {
                            message: `Text "${step.when}" not found within timeout`,
                        })
                        break
                    }
                    const sx = Math.round(match.cx / dpiScale) + match.windowX
                    const sy = Math.round(match.cy / dpiScale) + match.windowY
                    await withTimeout(
                        moveMouse(sx, sy),
                        STEP_ACTION_TIMEOUT,
                        `Hover "${match.text}" at (${sx}, ${sy})`,
                    )
                    sendEvent('success', {
                        message: `Hovered mouse on "${match.text}" at (${sx}, ${sy})`,
                        matchedText: match.text,
                        matchedBbox: match.bbox,
                    })
                    break
                }

                case 'mathVar': {
                    const resultVal = evaluateMathExpression(step.expression || '', workflowVars)
                    const sv = String(resultVal)
                    workflowVars.set(String(step.varName ?? ''), sv)
                    if (step.persist) {
                        const pv = loadPersistentVars()
                        pv.set(String(step.varName ?? ''), sv)
                        savePersistentVars(pv)
                    }
                    sendEvent('success', {
                        message: `Math evaluation: "${step.varName}" = ${step.expression} => "${sv}"`,
                    })
                    break
                }

                case 'repeat': {
                    const count = step.repeatCount || 5
                    const currentCount = repeatCounters.get(step.id) || 0
                    if (currentCount < count) {
                        repeatCounters.set(step.id, currentCount + 1)
                        const targetIdx = (step.targetStep ?? 1) - 1
                        if (targetIdx >= 0 && targetIdx < workflow.steps.length) {
                            i = targetIdx - 1
                            sendEvent('success', {
                                message: `Repeat loop iteration ${currentCount + 1}/${count}, jumping back to step ${targetIdx + 1}`,
                            })
                        } else {
                            sendEvent('error', {
                                message: `Invalid repeat target step ${step.targetStep}`,
                            })
                        }
                    } else {
                        repeatCounters.set(step.id, 0)
                        sendEvent('success', {
                            message: `Completed all ${count} repeat iterations`,
                        })
                    }
                    break
                }
            }
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)
            const action = step.onError || 'stop'
            if (action === 'ignore') {
                sendEvent('success', { message: `Ignored step error: ${errMsg}` })
            } else if (action === 'goto') {
                const targetIdx = (step.onErrorStep ?? 1) - 1
                if (targetIdx >= 0 && targetIdx < workflow.steps.length) {
                    sendEvent('success', {
                        message: `Step error: ${errMsg}. Recovering by jumping to step ${targetIdx + 1}`,
                    })
                    i = targetIdx - 1
                } else {
                    sendEvent('error', {
                        message: `Step error: ${errMsg}. Failed recovery jump to invalid step ${step.onErrorStep || '?'}`,
                    })
                    send('workflow:done', {
                        workflowName: workflow.name,
                        status: 'error',
                        completedSteps: i,
                        totalSteps: workflow.steps.length,
                        error: errMsg,
                    } satisfies WorkflowResult)
                    return
                }
            } else {
                sendEvent('error', { message: `Step failed: ${errMsg}` })
                send('workflow:done', {
                    workflowName: workflow.name,
                    status: 'error',
                    completedSteps: i,
                    totalSteps: workflow.steps.length,
                    error: errMsg,
                } satisfies WorkflowResult)
                return
            }
        }
    }

    send('workflow:done', {
        workflowName: workflow.name,
        status: 'completed',
        completedSteps: workflow.steps.length,
        totalSteps: workflow.steps.length,
    } satisfies WorkflowResult)
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
        promise.then(
            (v) => {
                clearTimeout(timer)
                resolve(v)
            },
            (e) => {
                clearTimeout(timer)
                reject(e)
            },
        )
    })
}

const STEP_ACTION_TIMEOUT = 30000

function sleepWithProgress(
    ms: number,
    stepIndex: number,
    type: WorkflowProgress['type'],
    workflowName: string,
    runId: number,
): Promise<void> {
    return new Promise((resolve) => {
        const chunk = 250
        let elapsed = 0
        const sendProgress = (e: number) => {
            send('workflow:progress', {
                workflowName,
                stepIndex,
                type,
                elapsed: e,
                total: ms,
                runId,
            } satisfies WorkflowProgress)
        }
        sendProgress(0)
        const tick = () => {
            if (workflowAbort) {
                resolve()
                return
            }
            const next = Math.min(chunk, ms - elapsed)
            if (next <= 0) {
                sendProgress(ms)
                resolve()
                return
            }
            elapsed += next
            sendProgress(Math.min(elapsed, ms))
            setTimeout(tick, next)
        }
        tick()
    })
}

function getAdbExe(config: SavedConfig): string {
    return config.adbPath || 'adb'
}

function resolveTemplate(value: string, vars: Map<string, string>): string {
    return value.replace(/\$\{(\w+)\}/g, (_, name) => vars.get(name) ?? '')
}

function adbTap(adb: string, x: number, y: number): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(`"${adb}" shell input tap ${x} ${y}`, { timeout: 15000 }, (err) => {
            if (err) reject(new Error(`adb tap failed: ${err.message}`))
            else resolve()
        })
    })
}

function adbSwipe(
    adb: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    durationMs: number = 100,
): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(
            `"${adb}" shell input swipe ${x1} ${y1} ${x2} ${y2} ${durationMs}`,
            { timeout: 15000 },
            (err) => {
                if (err) reject(new Error(`adb swipe failed: ${err.message}`))
                else resolve()
            },
        )
    })
}

function getDeviceResolution(adb: string): { width: number; height: number } {
    try {
        const out = execSync(`"${adb}" shell wm size`, { encoding: 'utf-8', timeout: 5000 })
        const match = out.match(/(\d+)x(\d+)/)
        if (match) return { width: parseInt(match[1]), height: parseInt(match[2]) }
    } catch {}
    return { width: 0, height: 0 }
}

async function findTextOnScreen(
    config: SavedConfig,
    pattern: string,
    matchIndex: number = 0,
    wholeWord: boolean = false,
    useRegex: boolean = false,
): Promise<{
    text: string
    bbox: { x0: number; y0: number; x1: number; y1: number }
    cx: number
    cy: number
    windowX: number
    windowY: number
    captureWidth: number
    captureHeight: number
} | null> {
    const wins = findWindowsByTitle(config.targetWindowTitle)
    if (wins.length === 0) return null

    const capture = await captureWindow(wins[0].id)
    const ocr = await ocrImage(capture.image, {
        lang: config.ocrLang || 'en-US',
    })

    const matched = matchBlocks(ocr.blocks, pattern, wholeWord, useRegex)
    if (matched.length === 0) return null

    let idx = matchIndex
    if (idx < 0) idx = matched.length + idx
    if (idx < 0 || idx >= matched.length) return null

    const block = matched[idx]
    const wx = Math.round((block.bbox.x0 + block.bbox.x1) / 2)
    const wy = Math.round((block.bbox.y0 + block.bbox.y1) / 2)

    return {
        text: block.text,
        bbox: block.bbox,
        cx: wx,
        cy: wy,
        windowX: wins[0].x,
        windowY: wins[0].y,
        captureWidth: capture.window.width,
        captureHeight: capture.window.height,
    }
}

function matchBlocks(
    blocks: any[],
    pattern: string,
    wholeWord: boolean,
    useRegex?: boolean,
): any[] {
    if (useRegex) {
        try {
            const re = new RegExp(pattern, 'i')
            return blocks.filter((b: any) => re.test(b.text))
        } catch {
            return []
        }
    }
    if (wholeWord) {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const re = new RegExp(`\\b${escaped}\\b`, 'i')
        return blocks.filter((b: any) => re.test(b.text))
    }
    const lower = pattern.toLowerCase()
    return blocks.filter((b: any) => b.text.toLowerCase().includes(lower))
}

async function waitForText(
    config: SavedConfig,
    pattern: string,
    timeoutMs: number,
    matchIndex: number = 0,
    wholeWord: boolean = false,
    useRegex: boolean = false,
    progressStepIndex?: number,
    progressWorkflowName?: string,
    runId?: number,
): Promise<{
    text: string
    bbox: { x0: number; y0: number; x1: number; y1: number }
    cx: number
    cy: number
    windowX: number
    windowY: number
    captureWidth: number
    captureHeight: number
} | null> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        if (workflowAbort) return null
        if (progressStepIndex !== undefined && progressWorkflowName) {
            if (workflowAbort) return null
            const elapsed = Date.now() - (deadline - timeoutMs)
            send('workflow:progress', {
                workflowName: progressWorkflowName,
                stepIndex: progressStepIndex,
                type: 'timeout',
                elapsed: Math.min(elapsed, timeoutMs),
                total: timeoutMs,
                runId: runId ?? 0,
            } satisfies WorkflowProgress)
        }
        try {
            const result = await withTimeout(
                findTextOnScreen(config, pattern, matchIndex, wholeWord, useRegex),
                10000,
                `OCR capture for "${pattern}"`,
            )
            if (result) return result
        } catch {
            // Per-attempt timeout, continue polling
        }
        await sleep(500)
    }
    if (progressStepIndex !== undefined && progressWorkflowName) {
        send('workflow:progress', {
            workflowName: progressWorkflowName,
            stepIndex: progressStepIndex,
            type: 'timeout',
            elapsed: timeoutMs,
            total: timeoutMs,
            runId: runId ?? 0,
        } satisfies WorkflowProgress)
    }
    return null
}

void app.whenReady().then(() => {
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

    ipcMain.handle(
        'run-workflow',
        async (
            _e,
            workflow: Workflow,
            config: SavedConfig,
            startIndex: number = 0,
            runId: number = 0,
        ) => {
            await runWorkflow(workflow, config, startIndex, runId)
        },
    )

    ipcMain.handle('stop-workflow', async () => {
        workflowAbort = true
    })

    ipcMain.handle('clear-persistent-vars', async () => {
        savePersistentVars(new Map())
    })

    ipcMain.handle('get-device-resolution', async (_e, adbExe?: string) =>
        getDeviceResolution(adbExe || 'adb'),
    )

    ipcMain.handle('resize-window', async (_e, handle: number, width: number, height: number) => {
        const psCommand = `
Add-Type @"
using System;
using System.Runtime.InteropServices;

public struct RECT {
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
}

public class Win32 {
  [DllImport("user32.dll")]
  public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern uint GetDpiForWindow(IntPtr hwnd);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("dwmapi.dll")]
  public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);
}
"@

$handleVal = [IntPtr]${handle}
$dpi = [Win32]::GetDpiForWindow($handleVal)
if ($dpi -eq 0) { $dpi = 96 }
$scale = $dpi / 96.0

$rectOuter = New-Object RECT
$rectVisible = New-Object RECT

[Win32]::GetWindowRect($handleVal, [ref]$rectOuter)
# 9 = DWMWA_EXTENDED_FRAME_BOUNDS
[Win32]::DwmGetWindowAttribute($handleVal, 9, [ref]$rectVisible, 16)

$outerW_logical = $rectOuter.Right - $rectOuter.Left
$outerH_logical = $rectOuter.Bottom - $rectOuter.Top
$visibleW_physical = $rectVisible.Right - $rectVisible.Left
$visibleH_physical = $rectVisible.Bottom - $rectVisible.Top

$visibleW_logical = $visibleW_physical / $scale
$visibleH_logical = $visibleH_physical / $scale

$padW_logical = $outerW_logical - $visibleW_logical
$padH_logical = $outerH_logical - $visibleH_logical

$logicalOuterW = [Math]::Round((${width} / $scale) + $padW_logical)
$logicalOuterH = [Math]::Round((${height} / $scale) + $padH_logical)

[Win32]::SetWindowPos($handleVal, [IntPtr]0, 0, 0, $logicalOuterW, $logicalOuterH, 0x0002 -bor 0x0004)
`
        try {
            execFileSync('powershell', ['-Command', psCommand], { timeout: 5000 })
            console.log(`[window] Resized window ${handle} to physical ${width}x${height}`)
        } catch (e: any) {
            console.error(`[window] Failed to resize window: ${e.message}`)
        }
    })

    ipcMain.handle('select-adb', async () => {
        const result = await dialog.showOpenDialog({
            title: 'Select ADB Executable',
            filters: [{ name: 'Executable', extensions: ['exe', 'bat', 'cmd', ''] }],
            properties: ['openFile'],
        })
        return result.canceled ? null : result.filePaths[0]
    })

    ipcMain.handle('minimize-window', () => {
        mainWindow?.minimize()
    })

    ipcMain.handle('maximize-window', () => {
        if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize()
        } else {
            mainWindow?.maximize()
        }
    })

    ipcMain.handle('close-window', () => {
        mainWindow?.close()
    })

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    stopWatcher()
    if (process.platform !== 'darwin') app.quit()
})
