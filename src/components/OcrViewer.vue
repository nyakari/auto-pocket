<script setup lang="ts">
    import { ref, onMounted } from 'vue'

    const emit = defineEmits<{ log: [level: string, msg: string] }>()

    const imageSrc = ref('')
    const ocrText = ref('')
    const ocrLines = ref<any[]>([])
    const lastCaptureTime = ref('')
    const watcherRunning = ref(false)

    function updateCapture(data: {
        image: string
        windowTitle: string
        ocr: { text: string; lines: any[] }
    }) {
        imageSrc.value = `data:image/png;base64,${data.image}`
        ocrText.value = data.ocr.text
        ocrLines.value = data.ocr.lines
        lastCaptureTime.value = new Date().toLocaleTimeString()
    }

    async function captureNow() {
        const wins = await window.api.listWindows()
        if (wins.length === 0) {
            emit('log', 'warn', 'No windows available')
            return
        }
        const config = await window.api.loadConfig()
        let target = wins[0]
        if (config.targetWindowTitle) {
            const found = wins.find((w: any) => w.title.includes(config.targetWindowTitle))
            if (found) target = found
        }
        const result = await window.api.captureWindow(target.id)
        const ocr = await window.api.ocrImageWithLang(result.image, config.ocrLang || 'eng')
        updateCapture({ image: result.image, windowTitle: target.title, ocr })
        emit('log', 'info', `Captured "${target.title}" – ${ocr.lines.length} lines`)
    }

    onMounted(async () => {
        const status = await window.api.getWatcherStatus()
        watcherRunning.value = status.running

        window.api.onWatcherStatus((s) => {
            watcherRunning.value = s.running
        })
        window.api.onWatcherCapture(updateCapture)
    })
</script>

<template>
    <div class="pane">
        <div class="toolbar">
            <h2>Live View</h2>
            <span class="ts">{{ lastCaptureTime }}</span>
            <button @click="captureNow" :disabled="watcherRunning">Capture Now</button>
        </div>

        <div v-if="imageSrc" class="image-area">
            <img :src="imageSrc" alt="screenshot" />
        </div>
        <div v-else class="placeholder">Click "Capture Now" or start the watcher</div>

        <div v-if="ocrText" class="ocr-result">
            <h3>OCR Text</h3>
            <pre>{{ ocrText.slice(0, 2000) }}</pre>
        </div>
    </div>
</template>

<style scoped>
    .pane {
        padding: 16px;
        height: 100%;
        display: flex;
        flex-direction: column;
    }
    .toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    }
    .toolbar h2 {
        font-size: 16px;
        color: #e94560;
    }
    .toolbar .ts {
        font-size: 11px;
        color: #888;
    }
    .toolbar button {
        margin-left: auto;
        background: #0f3460;
        color: #e0e0e0;
        border: 1px solid #1a1a4e;
        padding: 4px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    }
    .toolbar button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .image-area {
        border: 1px solid #0f3460;
        border-radius: 4px;
        overflow: auto;
        max-height: 50vh;
        background: #111;
    }
    .image-area img {
        display: block;
        max-width: 100%;
    }
    .placeholder {
        padding: 40px;
        text-align: center;
        color: #666;
        border: 1px dashed #333;
        border-radius: 4px;
        margin-bottom: 12px;
    }
    .ocr-result {
        margin-top: 12px;
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }
    .ocr-result h3 {
        font-size: 13px;
        color: #e94560;
        margin-bottom: 4px;
    }
    .ocr-result pre {
        flex: 1;
        overflow: auto;
        background: #111;
        border: 1px solid #0f3460;
        border-radius: 4px;
        padding: 8px;
        font-size: 12px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
    }
</style>
