<template>
    <div class="panel">
        <h3>Target Window</h3>
        <div class="select-row">
            <select v-model="selectedHandle" size="5">
                <option v-for="w in windows" :key="w.id" :value="w.id">
                    {{ w.title }} [{{ w.id }}]
                </option>
            </select>
        </div>
        <div class="btn-row">
            <button @click="refresh">&#8635; Refresh</button>
            <button @click="captureOnce" :disabled="loading || !selectedHandle">
                {{ loading ? '...' : 'Capture & OCR' }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { ref, onMounted } from 'vue'

    const emit = defineEmits<{ log: [level: string, msg: string] }>()

    const windows = ref<any[]>([])
    const selectedHandle = ref<number | null>(null)
    const loading = ref(false)

    onMounted(async () => {
        const wins = await window.api.listWindows()
        windows.value = wins
        if (wins.length > 0) selectedHandle.value = wins[0].id
        emit('log', 'info', `Found ${wins.length} windows`)
    })

    async function refresh() {
        windows.value = await window.api.listWindows()
        emit('log', 'info', `Refreshed: ${windows.value.length} windows`)
    }

    async function captureOnce() {
        if (!selectedHandle.value) return
        loading.value = true
        try {
            const result = await window.api.captureWindow(selectedHandle.value)
            emit('log', 'info', `Captured "${result.window.title}" (${result.image.length} bytes)`)
            const ocr = await window.api.ocrImage(result.image)
            emit('log', 'info', `OCR: ${ocr.lines.length} lines, ${ocr.blocks.length} words`)
        } catch (e: any) {
            emit('log', 'error', `Capture failed: ${e.message}`)
        }
        loading.value = false
    }
</script>

<style scoped>
    .panel {
        padding: 12px;
        border-bottom: 1px solid #2a2a2a;
    }
    h3 {
        font-size: 13px;
        color: #e94560;
        margin-bottom: 8px;
    }
    .select-row select {
        width: 100%;
        background: #1e1e1e;
        color: #ececec;
        border: 1px solid #2a2a2a;
        border-radius: 4px;
        font-size: 12px;
        min-height: 100px;
    }
    .select-row select option {
        padding: 2px 4px;
    }
    .btn-row {
        display: flex;
        gap: 6px;
        margin-top: 8px;
    }
    .btn-row button {
        flex: 1;
        background: #1e1e1e;
        color: #ececec;
        border: 1px solid #2a2a2a;
        padding: 6px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    }
    .btn-row button:hover {
        border-color: #404040;
    }
    .btn-row button:disabled {
        opacity: 0.4;
        cursor: default;
    }
</style>
