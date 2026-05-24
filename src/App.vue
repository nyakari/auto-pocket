<template>
    <div class="app">
        <header>
            <h1>Auto Pocket</h1>
            <nav>
                <button :class="{ active: activeTab === 'viewer' }" @click="activeTab = 'viewer'">
                    Viewer
                </button>
                <button :class="{ active: activeTab === 'config' }" @click="activeTab = 'config'">
                    Config
                </button>
                <button
                    :class="{ active: activeTab === 'workflow' }"
                    @click="activeTab = 'workflow'"
                >
                    Workflow
                </button>
            </nav>
            <span class="status" :class="{ running: watcherRunning }">
                {{ watcherRunning ? 'Watcher ON' : 'Watcher OFF' }}
            </span>
        </header>
        <div class="body">
            <aside>
                <WindowSelector v-if="activeTab !== 'workflow'" @log="addLog" />
                <ActionLog :lines="logLines" />
            </aside>
            <main>
                <OcrViewer v-if="activeTab === 'viewer'" @log="addLog" />
                <WorkflowEditor v-else-if="activeTab === 'workflow'" @log="addLog" />
                <ConfigPanel v-else @log="addLog" />
            </main>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { ref, onMounted, onUnmounted } from 'vue'
    import WindowSelector from './components/WindowSelector.vue'
    import OcrViewer from './components/OcrViewer.vue'
    import ActionLog from './components/ActionLog.vue'
    import ConfigPanel from './components/ConfigPanel.vue'
    import WorkflowEditor from './components/WorkflowEditor.vue'

    const activeTab = ref<'viewer' | 'config' | 'workflow'>('viewer')
    const logLines = ref<Array<{ time: string; level: string; msg: string }>>([])
    const watcherRunning = ref(false)

    function addLog(level: string, msg: string) {
        const time = new Date().toLocaleTimeString()
        logLines.value.push({ time, level, msg })
        if (logLines.value.length > 500) logLines.value.shift()
    }

    let cleanupFns: (() => void)[] = []

    onMounted(async () => {
        window.api.onWatcherStatus((s) => {
            watcherRunning.value = s.running
        })
        cleanupFns.push(
            window.api.onWatcherError((msg) => addLog('error', msg)),
            window.api.onWatcherMatch((data) =>
                addLog('match', `[${data.ruleName}] "${data.matchedText}"`),
            ),
        )
    })

    onUnmounted(() => {
        cleanupFns.forEach((fn) => fn())
    })
</script>
<style>
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #1a1a2e;
        color: #e0e0e0;
    }
    .app {
        display: flex;
        flex-direction: column;
        height: 100vh;
    }
    header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 16px;
        background: #16213e;
        border-bottom: 1px solid #0f3460;
        -webkit-app-region: drag;
    }
    header h1 {
        font-size: 16px;
        color: #e94560;
    }
    header nav {
        display: flex;
        gap: 4px;
        -webkit-app-region: no-drag;
    }
    header nav button {
        background: none;
        border: 1px solid #0f3460;
        color: #aaa;
        padding: 4px 12px;
        cursor: pointer;
        border-radius: 4px;
        font-size: 13px;
    }
    header nav button.active {
        background: #e94560;
        color: #fff;
        border-color: #e94560;
    }
    .status {
        margin-left: auto;
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 4px;
        background: #333;
    }
    .status.running {
        background: #2e7d32;
        color: #a5d6a7;
    }
    .body {
        display: flex;
        flex: 1;
        overflow: hidden;
    }
    aside {
        width: 600px;
        min-width: 600px;
        display: flex;
        flex-direction: column;
        border-right: 1px solid #0f3460;
        min-height: 0;
    }
    main {
        flex: 1;
        overflow-y: auto;
    }
</style>
