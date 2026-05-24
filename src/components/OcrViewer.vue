<script setup lang="ts">
    import { ref, onMounted, computed } from 'vue'

    const props = defineProps<{
        windows: any[]
        selectedHandle: number | null
    }>()

    const emit = defineEmits<{
        refreshWindows: []
        log: [level: string, msg: string]
    }>()

    const imageSrc = ref('')
    const ocrText = ref('')
    const ocrLines = ref<any[]>([])
    const lastCaptureTime = ref('')
    const watcherRunning = ref(false)
    const searchQuery = ref('')

    const captureWidth = ref(0)
    const captureHeight = ref(0)
    const selectedLine = ref<any | null>(null)

    const filteredLines = computed(() => {
        if (!searchQuery.value.trim()) return ocrLines.value
        const query = searchQuery.value.toLowerCase()
        return ocrLines.value.filter((l: any) => l.text.toLowerCase().includes(query))
    })

    function updateCapture(data: {
        image: string
        windowTitle: string
        ocr: { text: string; lines: any[] }
    }) {
        imageSrc.value = `data:image/png;base64,${data.image}`
        ocrText.value = data.ocr.text
        ocrLines.value = data.ocr.lines
        lastCaptureTime.value = new Date().toLocaleTimeString()
        selectedLine.value = null
    }

    async function captureNow() {
        if (!props.selectedHandle) {
            emit('log', 'warn', 'Select a target window first')
            return
        }
        const target = props.windows.find((w: any) => w.id === props.selectedHandle)
        if (!target) return
        const config = await window.api.loadConfig()
        try {
            const result = await window.api.captureWindow(props.selectedHandle)
            const ocr = await window.api.ocrImageWithLang(result.image, config.ocrLang || 'en-US')
            updateCapture({ image: result.image, windowTitle: target.title, ocr })
            emit('log', 'info', `Captured "${target.title}" – ${ocr.lines.length} lines`)
        } catch (e: any) {
            emit('log', 'error', `Capture failed: ${e.message || e}`)
        }
    }

    function onImageLoad(event: Event) {
        const target = event.target as HTMLImageElement
        captureWidth.value = target.naturalWidth
        captureHeight.value = target.naturalHeight
    }

    function lineStyle(line: any): Record<string, string> {
        if (captureWidth.value === 0 || captureHeight.value === 0) return {}
        return {
            left: (line.bbox.x0 / captureWidth.value) * 100 + '%',
            top: (line.bbox.y0 / captureHeight.value) * 100 + '%',
            width: ((line.bbox.x1 - line.bbox.x0) / captureWidth.value) * 100 + '%',
            height: ((line.bbox.y1 - line.bbox.y0) / captureHeight.value) * 100 + '%',
        }
    }

    function selectLine(line: any) {
        selectedLine.value = line
        emit('log', 'info', `Selected block: "${line.text}" at (${line.bbox.x0}, ${line.bbox.y0})`)
    }

    function copyAllText() {
        if (!ocrText.value) return
        navigator.clipboard.writeText(ocrText.value)
        emit('log', 'info', 'Copied full OCR text output to clipboard')
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
            <div class="title-section">
                <h2>Live view</h2>
                <span v-if="lastCaptureTime" class="timestamp">
                    <span class="pulse-icon"></span> {{ lastCaptureTime }}
                </span>
            </div>
            <div class="toolbar-actions">
                <input
                    v-model="searchQuery"
                    placeholder="Search text on screen..."
                    class="search-input"
                    :disabled="!imageSrc"
                />
                <button
                    @click="captureNow"
                    :disabled="watcherRunning || !selectedHandle"
                    class="btn-primary"
                >
                    Capture Now
                </button>
            </div>
        </div>

        <div class="split-view">
            <div class="view-left">
                <div v-if="imageSrc" class="image-container">
                    <div class="img-wrapper">
                        <img
                            :src="imageSrc"
                            alt="screenshot"
                            @load="onImageLoad"
                            draggable="false"
                        />

                        <!-- Line Bounding Box Overlays -->
                        <div
                            v-for="(line, index) in ocrLines"
                            :key="index"
                            class="ocr-line-overlay"
                            :class="{
                                matched:
                                    searchQuery &&
                                    line.text.toLowerCase().includes(searchQuery.toLowerCase()),
                                selected: selectedLine === line,
                                dimmed:
                                    searchQuery &&
                                    !line.text.toLowerCase().includes(searchQuery.toLowerCase()),
                            }"
                            :style="lineStyle(line)"
                            @click="selectLine(line)"
                        >
                            <span class="overlay-tooltip">{{ line.text }}</span>
                        </div>
                    </div>
                </div>
                <div v-else class="placeholder">
                    <svg
                        class="placeholder-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                    >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>Select a window and click "Capture Now" to analyze screen text.</span>
                </div>
            </div>

            <div class="view-right">
                <div class="ocr-result card">
                    <div class="result-header">
                        <h3>Parsed Text ({{ filteredLines.length }})</h3>
                        <button v-if="ocrText" @click="copyAllText" class="btn-text">
                            📋 Copy All
                        </button>
                    </div>

                    <div class="lines-list">
                        <div
                            v-for="(line, idx) in filteredLines"
                            :key="idx"
                            class="line-item"
                            :class="{
                                highlighted:
                                    searchQuery &&
                                    line.text.toLowerCase().includes(searchQuery.toLowerCase()),
                                active: selectedLine === line,
                            }"
                            @click="selectLine(line)"
                        >
                            <div class="line-meta">
                                <span class="line-idx">#{{ idx + 1 }}</span>
                                <span class="line-coords"
                                    >[{{ line.bbox.x0 }}, {{ line.bbox.y0 }}]</span
                                >
                            </div>
                            <span class="line-txt">{{ line.text }}</span>
                        </div>

                        <div
                            v-if="ocrLines.length > 0 && filteredLines.length === 0"
                            class="empty-state"
                        >
                            No lines match "{{ searchQuery }}"
                        </div>

                        <div v-if="ocrLines.length === 0" class="empty-state">
                            No text loaded. Capture screen to run OCR.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
    .pane {
        padding: 24px;
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 16px;
        background: var(--bg-main);
    }

    .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 14px;
        flex-shrink: 0;
    }

    .title-section {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    h2 {
        font-size: 20px;
        font-weight: 800;
        background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .timestamp {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-secondary);
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        padding: 4px 10px;
        border-radius: var(--radius-full);
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .pulse-icon {
        width: 6px;
        height: 6px;
        background: var(--color-accent);
        border-radius: 50%;
        animation: pulse 1.5s infinite;
    }

    .toolbar-actions {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .search-input {
        background: var(--bg-card);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 8px 14px;
        font-size: 13px;
        outline: none;
        transition: all var(--transition-fast);
        width: 240px;
    }

    .search-input:focus {
        border-color: var(--color-accent);
        box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.15);
    }

    .search-input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .btn-primary {
        background: var(--color-accent-gradient);
        border: none;
        color: white;
        padding: 8px 18px;
        border-radius: var(--radius-md);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all var(--transition-fast);
        box-shadow: 0 4px 12px rgba(244, 63, 94, 0.2);
    }

    .btn-primary:hover:not(:disabled) {
        opacity: 0.9;
        transform: translateY(-0.5px);
        box-shadow: 0 6px 16px rgba(244, 63, 94, 0.3);
    }

    .btn-primary:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        box-shadow: none;
    }

    .split-view {
        display: flex;
        flex: 1;
        gap: 20px;
        overflow: hidden;
        min-height: 0;
    }

    .view-left {
        flex: 1.2;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    .image-container {
        flex: 1;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        background: #09090b;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: auto;
        padding: 12px;
    }

    .img-wrapper {
        position: relative;
        display: inline-block;
        max-width: 100%;
    }

    .img-wrapper img {
        display: block;
        max-width: 100%;
        max-height: 70vh;
        border-radius: var(--radius-md);
        user-select: none;
    }

    .ocr-line-overlay {
        position: absolute;
        border: 1px solid rgba(139, 92, 246, 0.25);
        background: rgba(139, 92, 246, 0.03);
        cursor: pointer;
        box-sizing: border-box;
        transition: all var(--transition-fast);
        border-radius: 2px;
    }

    .ocr-line-overlay:hover {
        border-color: rgba(139, 92, 246, 0.8);
        background: rgba(139, 92, 246, 0.12);
        z-index: 8;
    }

    .ocr-line-overlay.matched {
        border-color: #10b981;
        background: rgba(16, 185, 129, 0.15);
        box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
        z-index: 9;
    }

    .ocr-line-overlay.selected {
        border-color: #f59e0b;
        background: rgba(245, 158, 11, 0.2);
        box-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
        z-index: 10;
    }

    .ocr-line-overlay.dimmed {
        opacity: 0.25;
    }

    .overlay-tooltip {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translate(-50%, -4px);
        background: #09090b;
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        padding: 4px 8px;
        border-radius: var(--radius-sm);
        font-size: 10px;
        font-family: var(--font-sans);
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--transition-fast);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        z-index: 100;
    }

    .ocr-line-overlay:hover .overlay-tooltip {
        opacity: 1;
    }

    .view-right {
        flex: 0.8;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    .ocr-result {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: 20px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }

    .result-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 14px;
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 10px;
        flex-shrink: 0;
    }

    .result-header h3 {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--color-accent);
        font-weight: 700;
    }

    .btn-text {
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: color var(--transition-fast);
    }

    .btn-text:hover {
        color: var(--color-accent);
    }

    .lines-list {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-right: 4px;
    }

    .line-item {
        background: var(--bg-main);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 10px 12px;
        cursor: pointer;
        transition: all var(--transition-fast);
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .line-item:hover {
        border-color: var(--border-hover);
        background: var(--bg-card-hover);
    }

    .line-item.highlighted {
        border-color: rgba(16, 185, 129, 0.4);
        background: rgba(16, 185, 129, 0.04);
    }

    .line-item.active {
        border-color: var(--color-warning);
        background: rgba(245, 158, 11, 0.05);
    }

    .line-meta {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        font-weight: 700;
        color: var(--text-muted);
    }

    .line-idx {
        color: var(--color-accent);
    }

    .line-txt {
        font-size: 13px;
        color: var(--text-primary);
        line-height: 1.4;
        word-break: break-all;
    }

    .empty-state {
        padding: 60px 20px;
        text-align: center;
        color: var(--text-muted);
        font-size: 13px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
    }

    .placeholder {
        padding: 80px 20px;
        text-align: center;
        color: var(--text-muted);
        border: 1px dashed var(--border-color);
        border-radius: var(--radius-lg);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        font-size: 13px;
        height: 100%;
    }

    .placeholder-icon {
        width: 40px;
        height: 40px;
        color: var(--border-color);
        margin-bottom: 4px;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
            transform: scale(1);
        }
        50% {
            opacity: 0.5;
            transform: scale(1.15);
        }
    }
</style>
