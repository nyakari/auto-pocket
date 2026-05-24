<script setup lang="ts">
    import { ref, watch } from 'vue'

    const props = defineProps<{ lines: Array<{ time: string; level: string; msg: string }> }>()
    defineEmits<{ clear: [] }>()
    const listRef = ref<HTMLDivElement | null>(null)

    watch(
        () => props.lines.length,
        () => {
            const el = listRef.value
            if (el) {
                el.scrollTop = el.scrollHeight
            }
        },
        { flush: 'post' },
    )

    function levelClass(l: string) {
        if (l === 'error') return 'err'
        if (l === 'match') return 'match'
        if (l === 'warn') return 'warn'
        return 'info'
    }

    function exportLogs() {
        if (props.lines.length === 0) return
        const text = props.lines
            .map((l) => `[${l.time}] [${l.level.toUpperCase()}] ${l.msg}`)
            .join('\n')
        const blob = new Blob([text], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `auto-pocket-logs-${Date.now()}.txt`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
    }
</script>

<template>
    <div class="log-panel">
        <div class="terminal-header">
            <div class="window-controls">
                <span class="control-dot close"></span>
                <span class="control-dot minimize"></span>
                <span class="control-dot maximize"></span>
            </div>
            <span class="terminal-title">Developer Console</span>
            <div class="log-actions" v-if="lines.length > 0">
                <button class="clear-btn" @click="$emit('clear')">Clear</button>
                <button
                    class="clear-btn export-btn"
                    @click="exportLogs"
                    title="Export logs to file"
                >
                    📥 Export
                </button>
            </div>
        </div>
        <div ref="listRef" class="log-list">
            <div v-for="(line, i) in lines" :key="i" :class="['log-line', levelClass(line.level)]">
                <span class="t">[{{ line.time }}]</span>
                <span class="lvl">[{{ line.level.toUpperCase() }}]</span>
                <span class="m">{{ line.msg }}</span>
            </div>
            <div v-if="lines.length === 0" class="empty">
                <svg
                    class="empty-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                >
                    <path
                        d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                    />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                <span>Console idle. Waiting for events...</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
    .log-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        background: #060608;
        border-top: 1px solid var(--border-color);
    }

    .terminal-header {
        display: flex;
        align-items: center;
        padding: 10px 16px;
        background: #09090b;
        border-bottom: 1px solid var(--border-color);
        justify-content: space-between;
    }

    .window-controls {
        display: flex;
        gap: 6px;
    }

    .control-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
    }

    .control-dot.close {
        background: #ef4444;
    }
    .control-dot.minimize {
        background: #f59e0b;
    }
    .control-dot.maximize {
        background: #10b981;
    }

    .terminal-title {
        font-size: 11px;
        font-family: var(--font-mono);
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .clear-btn {
        background: none;
        border: none;
        color: var(--text-muted);
        font-size: 10px;
        font-family: var(--font-mono);
        cursor: pointer;
    }

    .clear-btn:hover {
        color: var(--text-secondary);
    }

    .log-actions {
        display: flex;
        gap: 6px;
        align-items: center;
    }

    .export-btn {
        color: var(--accent, #6366f1);
    }

    .export-btn:hover {
        color: #818cf8;
    }

    .log-list {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        font-family: var(--font-mono);
        font-size: 11px;
        line-height: 1.5;
    }

    /* Custom thin scrollbar for console */
    .log-list::-webkit-scrollbar {
        width: 6px;
        height: 6px;
    }
    .log-list::-webkit-scrollbar-track {
        background: #060608;
    }
    .log-list::-webkit-scrollbar-thumb {
        background: #1e1e24;
        border-radius: 3px;
    }
    .log-list::-webkit-scrollbar-thumb:hover {
        background: #2d2d38;
    }

    .log-line {
        padding: 4px 0;
        display: flex;
        gap: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.01);
        align-items: flex-start;
        word-break: break-all;
    }

    .log-line .t {
        color: var(--text-muted);
        flex-shrink: 0;
    }

    .log-line .lvl {
        font-weight: 700;
        flex-shrink: 0;
        width: 50px;
    }

    .log-line .m {
        color: var(--text-primary);
    }

    /* Color styles for different levels */
    .log-line.info .lvl {
        color: var(--text-secondary);
    }

    .log-line.err .lvl {
        color: var(--color-danger);
    }
    .log-line.err .m {
        color: #fca5a5;
    }

    .log-line.match .lvl {
        color: var(--color-success);
    }
    .log-line.match .m {
        color: #a7f3d0;
    }

    .log-line.warn .lvl {
        color: var(--color-warning);
    }
    .log-line.warn .m {
        color: #fde68a;
    }

    .empty {
        color: var(--text-muted);
        padding: 32px 16px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        height: 100%;
    }

    .empty-icon {
        width: 24px;
        height: 24px;
        color: #1e1e24;
    }
</style>
