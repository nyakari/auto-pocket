import {
    listWindows,
    captureWindow,
    captureScreen,
    ocrImage,
    Watcher,
    toScreenCoords,
} from '../lib/index'

async function exampleOneShot() {
    console.log('=== One-Shot OCR Demo ===')

    const windows = listWindows()
    console.log(`Found ${windows.length} windows:`)

    for (const w of windows.slice(0, 10)) {
        console.log(`  [${w.id}] ${w.title} (${w.appName})`)
    }

    if (windows.length === 0) return

    const target = windows[0]
    console.log(`\nCapturing: "${target.title}"...`)

    const capture = await captureWindow(target.id)
    console.log(`  Image: ${capture.image.length} bytes, ${target.width}x${target.height}`)

    const result = await ocrImage(capture.image)

    console.log(`\nOCR Result:`)
    console.log(`  Text: "${result.text.slice(0, 200)}..."`)
    console.log(`  Confidence: ${result.confidence}`)
    console.log(`  Words: ${result.blocks.length}`)
    console.log(`  Lines: ${result.lines.length}`)

    for (const line of result.lines.slice(0, 5)) {
        const screenPos = toScreenCoords(line.bbox, { x: target.x, y: target.y })
        console.log(`  "${line.text}" @ screen(${screenPos.x}, ${screenPos.y})`)
    }
}

async function exampleWatchMode() {
    console.log('\n=== Watch Mode Demo ===')

    const windows = listWindows()
    if (windows.length === 0) {
        console.log('No windows found')
        return
    }

    const target = windows[0]
    console.log(`Watching: "${target.title}" (handle: ${target.id})`)

    const watcher = new Watcher({
        target: { handle: target.id },
        interval: 3000,
        rules: [
            {
                name: 'click on Save',
                when: /Save|保存/,
                action: async (event) => {
                    const block = event.matchedBlocks[0]
                    const pos = toScreenCoords(block.bbox, event.screenOffset)
                    console.log(`Matched "${block.text}" at (${pos.x}, ${pos.y})`)
                },
            },
        ],
        onError: (err) => console.error('Watcher error:', err.message),
    })

    watcher.start()
    console.log('Watcher started (will stop in 10 seconds)...')

    return new Promise<void>((resolve) => {
        setTimeout(() => {
            watcher.stop()
            console.log('Watcher stopped')
            resolve()
        }, 10000)
    })
}

async function exampleCaptureScreen() {
    console.log('\n=== Full Screen Capture Demo ===')

    const screenshot = await captureScreen()
    console.log(`Screenshot: ${screenshot.length} bytes`)

    const result = await ocrImage(screenshot)
    console.log(`Screen text (first 200 chars): "${result.text.slice(0, 200)}"`)
}

async function main() {
    await exampleOneShot()
    await exampleCaptureScreen()
    await exampleWatchMode()

    console.log('\nDone!')
}

main().catch(console.error)
