<template>
    <div class="pane">
        <h2>Configuration</h2>

        <section>
            <label>Target Window Title (substring match)</label>
            <input
                v-model="targetWindowTitle"
                placeholder="e.g. Notepad"
                :disabled="watcherRunning"
            />
        </section>
        <section>
            <label>Poll Interval (ms)</label>
            <input
                v-model.number="pollInterval"
                type="number"
                min="500"
                step="500"
                :disabled="watcherRunning"
            />
        </section>
        <section>
            <label>OCR Language</label>
            <select v-model="ocrLang" :disabled="watcherRunning">
                <option value="eng">English</option>
                <option value="jpn">Japanese</option>
                <option value="kor">Korean</option>
                <option value="chi_sim">Chinese (Simplified)</option>
                <option value="deu">German</option>
                <option value="fra">French</option>
            </select>
        </section>

        <section>
            <div class="section-header">
                <label>Rules</label>
                <button class="small" @click="addRule" :disabled="watcherRunning">
                    + Add Rule
                </button>
            </div>
            <div v-for="(r, i) in rules" :key="i" class="rule-card">
                <input v-model="r.name" placeholder="Rule name" :disabled="watcherRunning" />
                <input
                    v-model="r.when"
                    placeholder='Text to match (e.g. "Submit")'
                    :disabled="watcherRunning"
                />
                <div class="rule-actions">
                    <select v-model="r.action" :disabled="watcherRunning">
                        <option value="click">Click</option>
                        <option value="doubleclick">Double Click</option>
                        <option value="type">Type Text</option>
                    </select>
                    <input
                        v-if="r.action === 'type'"
                        v-model="r.actionText"
                        placeholder="Text to type"
                        :disabled="watcherRunning"
                    />
                    <button class="small danger" @click="removeRule(i)" :disabled="watcherRunning">
                        &#10005;
                    </button>
                </div>
            </div>
            <div v-if="rules.length === 0" class="no-rules">No rules defined. Add one above.</div>
        </section>

        <div class="actions">
            <button @click="save" :disabled="watcherRunning">Save Config</button>
            <button v-if="!watcherRunning" class="start" @click="startWatcher">
                Start Watcher
            </button>
            <button v-else class="stop" @click="stopWatcher">Stop Watcher</button>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { ref, onMounted, toRaw } from 'vue'

    const emit = defineEmits<{ log: [level: string, msg: string] }>()

    const targetWindowTitle = ref('')
    const pollInterval = ref(2000)
    const ocrLang = ref('eng')
    const rules = ref<Array<{ name: string; when: string; action: string; actionText: string }>>([])
    const watcherRunning = ref(false)

    function addRule() {
        rules.value.push({ name: '', when: '', action: 'click', actionText: '' })
    }

    function removeRule(i: number) {
        rules.value.splice(i, 1)
    }

    async function save() {
        await window.api.saveConfig({
            targetWindowTitle: targetWindowTitle.value,
            pollInterval: pollInterval.value,
            ocrLang: ocrLang.value,
            rules: toRaw(rules.value),
        })
        emit('log', 'info', 'Config saved')
    }

    async function startWatcher() {
        await save()
        await window.api.startWatcher({
            targetWindowTitle: targetWindowTitle.value,
            pollInterval: pollInterval.value,
            ocrLang: ocrLang.value,
            rules: toRaw(rules.value),
        })
        watcherRunning.value = true
        emit('log', 'info', 'Watcher started')
    }

    async function stopWatcher() {
        await window.api.stopWatcher()
        watcherRunning.value = false
        emit('log', 'info', 'Watcher stopped')
    }

    onMounted(async () => {
        const c = await window.api.loadConfig()
        targetWindowTitle.value = c.targetWindowTitle || ''
        pollInterval.value = c.pollInterval || 2000
        ocrLang.value = c.ocrLang || 'eng'
        rules.value = c.rules || []
        const status = await window.api.getWatcherStatus()
        watcherRunning.value = status.running
    })
</script>

<style scoped>
    .pane {
        padding: 20px;
        max-width: 600px;
    }
    h2 {
        font-size: 16px;
        color: #e94560;
        margin-bottom: 16px;
    }
    section {
        margin-bottom: 16px;
    }
    label {
        display: block;
        font-size: 12px;
        color: #aaa;
        margin-bottom: 4px;
    }
    input,
    select {
        width: 100%;
        background: #0f3460;
        color: #e0e0e0;
        border: 1px solid #1a1a4e;
        border-radius: 4px;
        padding: 6px 8px;
        font-size: 13px;
    }
    input:disabled,
    select:disabled {
        opacity: 0.5;
    }
    .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
    }
    .section-header label {
        margin: 0;
    }
    button.small {
        background: #0f3460;
        color: #e0e0e0;
        border: 1px solid #1a1a4e;
        padding: 2px 8px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
    }
    button.danger {
        color: #ef5350;
    }
    .rule-card {
        background: #16213e;
        border: 1px solid #0f3460;
        border-radius: 4px;
        padding: 8px;
        margin-bottom: 6px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .rule-card input {
        font-size: 12px;
        padding: 4px 6px;
    }
    .rule-actions {
        display: flex;
        gap: 4px;
        align-items: center;
    }
    .rule-actions select {
        flex: 0 0 100px;
        font-size: 12px;
        padding: 3px 4px;
    }
    .rule-actions input {
        flex: 1;
        font-size: 12px;
    }
    .rule-actions button {
        flex: 0;
    }
    .no-rules {
        font-size: 12px;
        color: #555;
        padding: 8px;
        text-align: center;
    }
    .actions {
        display: flex;
        gap: 8px;
        margin-top: 20px;
    }
    .actions button {
        flex: 1;
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        color: #fff;
    }
    .actions button:disabled {
        opacity: 0.4;
    }
    .actions button:not(.start):not(.stop) {
        background: #0f3460;
        color: #e0e0e0;
        border: 1px solid #1a1a4e;
    }
    .start {
        background: #2e7d32;
    }
    .stop {
        background: #c62828;
    }
</style>
