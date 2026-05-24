<script setup lang="ts">
    import { ref, watch, nextTick } from 'vue'

    const props = defineProps<{ lines: Array<{ time: string; level: string; msg: string }> }>()
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
</script>

<template>
    <div class="log-panel">
        <h3>Log</h3>
        <div ref="listRef" class="log-list">
            <div v-for="(line, i) in lines" :key="i" :class="['log-line', levelClass(line.level)]">
                <span class="t">{{ line.time }}</span>
                <span class="m">{{ line.msg }}</span>
            </div>
            <div v-if="lines.length === 0" class="empty">No events yet</div>
        </div>
    </div>
</template>

<style scoped>
    .log-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }
    h3 {
        font-size: 13px;
        color: #e94560;
        padding: 12px 12px 4px;
    }
    .log-list {
        flex: 1;
        overflow: auto;
        padding: 4px 12px 12px;
        font-family: 'Cascadia Code', 'Fira Code', monospace;
        font-size: 11px;
    }
    .log-line {
        padding: 2px 0;
        border-bottom: 1px solid #111;
        display: flex;
        gap: 8px;
    }
    .log-line .t {
        color: #666;
        white-space: nowrap;
    }
    .log-line .m {
        color: #ccc;
        white-space: nowrap;
    }
    .log-line.err .m {
        color: #ef5350;
    }
    .log-line.match .m {
        color: #66bb6a;
    }
    .log-line.warn .m {
        color: #ffa726;
    }
    .empty {
        color: #444;
        padding: 12px;
        text-align: center;
    }
</style>
