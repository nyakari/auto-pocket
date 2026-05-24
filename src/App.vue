<template>
    <div class="app">
        <header>
            <div class="brand">
                <div class="logo-glow"></div>
                <svg
                    class="brand-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M12 2L2 7L12 12L22 7L12 2Z"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                    <path
                        d="M2 17L12 22L22 17"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                    <path
                        d="M2 12L12 17L22 12"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
                <h1>Auto Pocket</h1>
            </div>

            <!-- Global Target Window Selector in Header -->
            <div class="header-target-selector">
                <span class="selector-label">🎯 Target:</span>
                <div class="select-wrapper">
                    <select v-model="selectedHandle" class="custom-select-inline">
                        <option value="" disabled>-- Select Target Window --</option>
                        <option v-for="w in windows" :key="w.id" :value="w.id">
                            {{ w.title || 'Untitled Window' }} [{{ w.id }}]
                        </option>
                    </select>
                </div>
                <button
                    class="btn btn-secondary btn-icon-only"
                    @click="refreshWindows"
                    title="Refresh Windows"
                >
                    🔄
                </button>
            </div>

            <div style="margin-left: auto; display: flex; align-items: center; gap: 8px">
                <div class="watcher-badge" v-if="watcherRunning">
                    <span class="status-dot"></span>
                    <span class="status-text">Watcher ON</span>
                </div>

                <!-- Global Settings Button in Header -->
                <button
                    class="btn btn-secondary btn-settings"
                    @click="settingsModalOpen = true"
                    title="Settings"
                >
                    ⚙️ Settings
                </button>

                <div class="window-controls">
                    <button class="win-btn win-minimize" @click="minimizeWindow" title="Minimize">
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <rect x="1" y="5.5" width="10" height="1" fill="currentColor" />
                        </svg>
                    </button>
                    <button class="win-btn win-maximize" @click="maximizeWindow" title="Maximize">
                        <svg v-if="!isMaximized" width="12" height="12" viewBox="0 0 12 12">
                            <rect
                                x="1.5"
                                y="1.5"
                                width="9"
                                height="9"
                                rx="1"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1"
                            />
                        </svg>
                        <svg v-else width="12" height="12" viewBox="0 0 12 12">
                            <rect
                                x="3"
                                y="0.5"
                                width="8"
                                height="8"
                                rx="1"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1"
                            />
                            <rect
                                x="0.5"
                                y="3"
                                width="8"
                                height="8"
                                rx="1"
                                fill="var(--bg-main)"
                                stroke="currentColor"
                                stroke-width="1"
                            />
                        </svg>
                    </button>
                    <button class="win-btn win-close" @click="closeWindow" title="Close">
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <line
                                x1="2"
                                y1="2"
                                x2="10"
                                y2="10"
                                stroke="currentColor"
                                stroke-width="1.2"
                            />
                            <line
                                x1="10"
                                y1="2"
                                x2="2"
                                y2="10"
                                stroke="currentColor"
                                stroke-width="1.2"
                            />
                        </svg>
                    </button>
                </div>
            </div>
        </header>

        <div class="body">
            <main>
                <WorkflowEditor
                    :windows="windows"
                    v-model:selected-handle="selectedHandle"
                    :use-scrcpy="useScrcpy"
                    :adb-path="adbPath"
                    :log-lines="logLines"
                    @clear-logs="logLines = []"
                    @refresh-windows="refreshWindows"
                    @log="addLog"
                />
            </main>
        </div>

        <!-- Global Settings Modal -->
        <div v-if="settingsModalOpen" class="modal-overlay" @click.self="settingsModalOpen = false">
            <div class="modal-card">
                <div class="modal-header">
                    <h3>Global Settings</h3>
                    <button class="close-modal-btn" @click="settingsModalOpen = false">✕</button>
                </div>
                <div class="modal-body">
                    <section class="form-group">
                        <label>Default Step Delay (s)</label>
                        <input
                            v-model.number="defaultWaitMs"
                            type="number"
                            min="0"
                            step="0.1"
                            class="custom-input"
                        />
                    </section>

                    <section class="form-group">
                        <label>OCR Language</label>
                        <div class="select-wrapper">
                            <select v-model="ocrLang" class="custom-select">
                                <option value="en-US">English</option>
                                <option value="ja-JP">Japanese</option>
                                <option value="ko-KR">Korean</option>
                                <option value="zh-CN">Chinese (Simplified)</option>
                                <option value="de-DE">German</option>
                                <option value="fr-FR">French</option>
                            </select>
                        </div>
                    </section>

                    <section class="form-group">
                        <label>OCR Scale (Accuracy multiplier)</label>
                        <div class="select-wrapper">
                            <select v-model.number="ocrScale" class="custom-select">
                                <option :value="1">1x (Fastest)</option>
                                <option :value="2">2x (Balanced)</option>
                                <option :value="3">3x (Most Accurate)</option>
                            </select>
                        </div>
                    </section>

                    <section class="form-group">
                        <label>Automation Mode</label>
                        <div class="toggle-group">
                            <button
                                type="button"
                                class="toggle-btn"
                                :class="{ active: !useScrcpy }"
                                @click="useScrcpy = false"
                            >
                                🖱️ Mouse Control
                            </button>
                            <button
                                type="button"
                                class="toggle-btn"
                                :class="{ active: useScrcpy }"
                                @click="useScrcpy = true"
                            >
                                📱 scrcpy / ADB
                            </button>
                        </div>
                    </section>

                    <section v-if="useScrcpy" class="form-group">
                        <label>ADB Command Path</label>
                        <div class="adb-row">
                            <input v-model="adbPath" placeholder="e.g. adb" class="custom-input" />
                            <button class="btn btn-secondary btn-small" @click="browseAdb">
                                Browse
                            </button>
                        </div>
                    </section>

                    <section class="form-group">
                        <label>Watcher Poll Interval (ms)</label>
                        <input
                            v-model.number="pollInterval"
                            type="number"
                            min="500"
                            step="500"
                            class="custom-input"
                        />
                    </section>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" @click="settingsModalOpen = false">
                        Cancel
                    </button>
                    <button class="btn btn-primary" @click="saveSettings">Save Settings</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { ref, onMounted, onUnmounted, watch } from 'vue'
    import WorkflowEditor from './components/WorkflowEditor.vue'

    const logLines = ref<Array<{ time: string; level: string; msg: string }>>([])
    const watcherRunning = ref(false)

    // Lifted Window/Target state
    const windows = ref<any[]>([])
    const selectedHandle = ref<number | null>(null)

    // Settings Modal State
    const settingsModalOpen = ref(false)
    const pollInterval = ref(2000)
    const ocrLang = ref('en-US')
    const ocrScale = ref(1)
    const defaultWaitMs = ref(0.5)
    const useScrcpy = ref(false)
    const adbPath = ref('adb')
    const isMaximized = ref(false)

    watch(selectedHandle, async (val) => {
        if (val === null) return
        const win = windows.value.find((w) => w.id === val)
        if (win) {
            try {
                const config = await window.api.loadConfig()
                if (config.targetWindowTitle !== win.title) {
                    config.targetWindowTitle = win.title
                    await window.api.saveConfig(config)
                }
            } catch (e: any) {
                addLog('error', `Failed to sync target window config: ${e.message || e}`)
            }
        }
    })

    async function refreshWindows() {
        try {
            const wins = await window.api.listWindows()
            windows.value = wins
            if (wins.length > 0) {
                if (!selectedHandle.value || !wins.some((w) => w.id === selectedHandle.value)) {
                    selectedHandle.value = wins[0].id
                }
            } else {
                selectedHandle.value = null
            }
        } catch (e: any) {
            addLog('error', `Failed to list windows: ${e.message || e}`)
        }
    }

    async function browseAdb() {
        const result = await window.api.selectAdb()
        if (result) adbPath.value = result
    }

    async function saveSettings() {
        try {
            const existing = await window.api.loadConfig()
            const win = windows.value.find((w) => w.id === selectedHandle.value)

            const newConfig = {
                ...existing,
                targetWindowTitle: win ? win.title : existing.targetWindowTitle,
                pollInterval: pollInterval.value,
                ocrLang: ocrLang.value,
                ocrScale: ocrScale.value,
                defaultWaitMs: defaultWaitMs.value * 1000, // Convert to ms
                useScrcpy: useScrcpy.value,
                adbPath: adbPath.value,
            }

            await window.api.saveConfig(newConfig)
            settingsModalOpen.value = false
            addLog('info', 'Global settings saved')
        } catch (e: any) {
            addLog('error', `Failed to save settings: ${e.message || e}`)
        }
    }

    async function minimizeWindow() {
        await window.api.minimizeWindow()
    }

    async function maximizeWindow() {
        await window.api.maximizeWindow()
    }

    async function closeWindow() {
        await window.api.closeWindow()
    }

    function addLog(level: string, msg: string) {
        const time = new Date().toLocaleTimeString()
        logLines.value.push({ time, level, msg })
        if (logLines.value.length > 500) logLines.value.shift()
    }

    let cleanupFns: (() => void)[] = []

    onMounted(async () => {
        await refreshWindows()

        const config = await window.api.loadConfig()
        pollInterval.value = config.pollInterval || 2000
        ocrLang.value = config.ocrLang || 'en-US'
        ocrScale.value = config.ocrScale || 1
        defaultWaitMs.value =
            config.defaultWaitMs > 60 ? config.defaultWaitMs / 1000 : config.defaultWaitMs || 0.5
        useScrcpy.value = config.useScrcpy ?? false
        adbPath.value = config.adbPath || 'adb'

        window.api.onWatcherStatus((s) => {
            watcherRunning.value = s.running
        })
        cleanupFns.push(
            window.api.onWatcherError((msg) => addLog('error', msg)),
            window.api.onWatcherMatch((data) =>
                addLog('match', `[${data.ruleName}] "${data.matchedText}"`),
            ),
            window.api.onWindowMaximized((maximized) => {
                isMaximized.value = maximized
            }),
        )
    })

    onUnmounted(() => {
        cleanupFns.forEach((fn) => fn())
    })
</script>

<style>
    :root {
        --bg-main: #09090b;
        --bg-panel: #0c0c0e;
        --bg-card: #18181b;
        --bg-card-hover: #202024;
        --border-color: #27272a;
        --border-hover: #3f3f46;
        --text-primary: #f4f4f5;
        --text-secondary: #a1a1aa;
        --text-muted: #71717a;
        --color-accent: #f43f5e;
        --color-accent-hover: #fb7185;
        --color-accent-gradient: linear-gradient(135deg, #f43f5e 0%, #ec4899 100%);
        --color-success: #10b981;
        --color-success-gradient: linear-gradient(135deg, #10b981 0%, #059669 100%);
        --color-warning: #f59e0b;
        --color-danger: #ef4444;
        --color-danger-gradient: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        --font-sans: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        --font-mono: 'JetBrains Mono', monospace;
        --radius-sm: 6px;
        --radius-md: 10px;
        --radius-lg: 14px;
        --radius-full: 9999px;
        --shadow-glow: 0 0 15px rgba(244, 63, 94, 0.2);
        --transition-fast: 0.15s ease;
        --transition-normal: 0.25s ease;
    }

    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    body {
        font-family: var(--font-sans);
        background: var(--bg-main);
        color: var(--text-primary);
        overflow: hidden;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }

    /* Custom Scrollbar Styles */
    ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    ::-webkit-scrollbar-track {
        background: var(--bg-main);
    }
    ::-webkit-scrollbar-thumb {
        background: var(--border-color);
        border-radius: var(--radius-sm);
    }
    ::-webkit-scrollbar-thumb:hover {
        background: var(--border-hover);
    }

    .app {
        display: flex;
        flex-direction: column;
        height: 100vh;
    }

    header {
        display: flex;
        align-items: center;
        gap: 24px;
        padding: 12px 24px;
        background: rgba(12, 12, 14, 0.8);
        border-bottom: 1px solid var(--border-color);
        backdrop-filter: blur(12px);
        -webkit-app-region: drag;
        z-index: 10;
    }

    .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        position: relative;
    }

    .brand-icon {
        width: 20px;
        height: 20px;
        color: var(--color-accent);
        animation: float 4s ease-in-out infinite;
    }

    .logo-glow {
        position: absolute;
        width: 24px;
        height: 24px;
        background: var(--color-accent);
        filter: blur(20px);
        opacity: 0.6;
        left: 0;
        top: 0;
        border-radius: 50%;
        pointer-events: none;
    }

    header h1 {
        font-size: 18px;
        font-weight: 700;
        letter-spacing: -0.5px;
        background: var(--color-accent-gradient);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    /* Target Selector inside Header */
    .header-target-selector {
        display: flex;
        align-items: center;
        gap: 8px;
        -webkit-app-region: no-drag;
    }

    .selector-label {
        font-size: 12px;
        font-weight: 700;
        color: var(--text-secondary);
    }

    .select-wrapper {
        position: relative;
    }

    .custom-select-inline {
        background: var(--bg-card);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        font-size: 12px;
        font-weight: 600;
        padding: 6px 24px 6px 12px;
        outline: none;
        cursor: pointer;
        appearance: none;
        transition: border-color var(--transition-fast);
        max-width: 280px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .select-wrapper::after {
        content: '▼';
        font-size: 7px;
        color: var(--text-muted);
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
    }

    .custom-select-inline:focus {
        border-color: var(--color-accent);
    }

    .btn-icon-only {
        padding: 6px !important;
        font-size: 11px !important;
        line-height: 1;
    }

    .watcher-badge {
        margin-left: auto;
        font-size: 12px;
        font-weight: 600;
        padding: 6px 14px;
        border-radius: var(--radius-full);
        background: var(--bg-card);
        border: 1px solid rgba(16, 185, 129, 0.3);
        display: flex;
        align-items: center;
        gap: 8px;
        -webkit-app-region: no-drag;
        box-shadow: 0 0 15px rgba(16, 185, 129, 0.15);
    }

    .watcher-badge .status-dot {
        width: 8px;
        height: 8px;
        background: var(--color-success);
        border-radius: 50%;
        display: inline-block;
        box-shadow: 0 0 10px var(--color-success);
        animation: pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    .watcher-badge .status-text {
        color: var(--color-success);
    }

    .btn-settings {
        -webkit-app-region: no-drag;
    }

    .window-controls {
        display: flex;
        align-items: center;
        -webkit-app-region: no-drag;
        margin-left: 8px;
    }

    .win-btn {
        width: 46px;
        height: 34px;
        border: none;
        background: transparent;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border-radius: 8px;
        overflow: hidden;
        transition:
            background var(--transition-fast),
            color var(--transition-fast);
    }

    .win-btn:hover {
        background: rgba(255, 255, 255, 0.06);
        color: var(--text-primary);
    }

    .win-close:hover {
        background: #e81123;
        color: white;
    }

    .body {
        display: flex;
        flex: 1;
        overflow: hidden;
        background: var(--bg-panel);
    }

    main {
        flex: 1;
        overflow-y: auto;
        background: var(--bg-main);
    }

    /* Modal Styling */
    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        animation: fadeIn var(--transition-fast) ease-out;
    }

    .modal-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        width: 480px;
        max-width: 90vw;
        padding: 24px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 12px;
    }

    .modal-header h3 {
        font-size: 16px;
        font-weight: 700;
        background: var(--color-accent-gradient);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .close-modal-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 16px;
        transition: color var(--transition-fast);
    }

    .close-modal-btn:hover {
        color: var(--text-primary);
    }

    .modal-body {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        border-top: 1px solid var(--border-color);
        padding-top: 16px;
    }

    /* Shared Modal Form Styling */
    .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .form-group label {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
    }

    .custom-input {
        background: var(--bg-main);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 10px 14px;
        font-size: 13px;
        outline: none;
        transition: border-color var(--transition-fast);
        width: 100%;
    }

    .custom-input:focus {
        border-color: var(--color-accent);
    }

    .custom-select {
        width: 100%;
        background: var(--bg-main);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 10px 14px;
        font-size: 13px;
        outline: none;
        appearance: none;
        cursor: pointer;
        transition: border-color var(--transition-fast);
    }

    .custom-select:focus {
        border-color: var(--color-accent);
    }

    .adb-row {
        display: flex;
        gap: 10px;
    }

    .toggle-group {
        display: flex;
        background: var(--bg-main);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 4px;
        gap: 4px;
    }

    .toggle-btn {
        flex: 1;
        background: transparent;
        border: none;
        color: var(--text-secondary);
        padding: 8px;
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all var(--transition-fast);
    }

    .toggle-btn:hover {
        color: var(--text-primary);
        background: rgba(255, 255, 255, 0.02);
    }

    .toggle-btn.active {
        background: var(--color-accent);
        color: white;
        box-shadow: 0 2px 8px rgba(244, 63, 94, 0.3);
    }

    /* Buttons */
    .btn {
        padding: 8px 16px;
        border-radius: var(--radius-md);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all var(--transition-fast);
        border: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .btn-primary {
        background: var(--color-accent-gradient);
        color: white;
        box-shadow: 0 4px 12px rgba(244, 63, 94, 0.2);
    }

    .btn-primary:hover {
        opacity: 0.9;
        transform: translateY(-0.5px);
    }

    .btn-secondary {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
    }

    .btn-secondary:hover {
        background: var(--bg-card-hover);
        border-color: var(--border-hover);
    }

    .btn-small {
        padding: 6px 12px;
        font-size: 11px;
    }

    @keyframes pulse-ring {
        0%,
        100% {
            opacity: 1;
            transform: scale(1);
        }
        50% {
            opacity: 0.5;
            transform: scale(1.2);
        }
    }

    @keyframes float {
        0%,
        100% {
            transform: translateY(0px);
        }
        50% {
            transform: translateY(-2px);
        }
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
</style>
