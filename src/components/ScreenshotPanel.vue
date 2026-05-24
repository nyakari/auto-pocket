<template>
    <div class="screenshot-area">
        <div class="toolbar">
            <h3>Screenshot</h3>
            <select v-model="localHandle" class="window-select" :disabled="disabled">
                <option v-for="w in windows" :key="w.id" :value="w.id">
                    {{ w.title }} [{{ w.id }}]
                </option>
            </select>
            <button class="small" @click="emit('refreshWindows')">&#8635;</button>
            <button
                class="small capture-btn"
                @click="emit('capture')"
                :disabled="!localHandle || disabled"
            >
                {{ isPicking ? 'Pick coordinate' : 'Capture' }}
            </button>
            <button
                class="small blocks-btn"
                @click="emit('toggleOcrBlocks')"
                :disabled="!screenshotSrc || disabled"
                :class="{ active: showOcrBlocks }"
            >
                {{ showOcrBlocks ? 'Hide blocks' : 'Show blocks' }}
            </button>
        </div>
        <div v-if="screenshotWindow" class="window-label">
            {{ screenshotWindow.title }}
        </div>
        <div v-if="pickHint" class="pick-hint">
            {{ pickHint }}
            <span v-if="hoverCoord" class="hover-coord"
                >({{ hoverCoord.x }}, {{ hoverCoord.y }})</span
            >
        </div>
        <div
            v-if="screenshotSrc"
            class="img-wrapper"
            ref="imgWrapperRef"
            @click="onImgClick"
            @mousemove="onImgHover"
            @mouseleave="emit('hoverClear')"
        >
            <img :src="screenshotSrc" draggable="false" ref="imgRef" @load="onImgLoad" />
            <div
                v-for="mark in xyMarkers"
                :key="mark.id"
                class="xy-marker"
                :style="{ left: mark.xPct + '%', top: mark.yPct + '%' }"
                :title="'(' + mark.x + ', ' + mark.y + ')'"
            >
                <span class="marker-dot"></span>
                <span class="marker-label">{{ mark.label }}</span>
            </div>
            <div v-for="mark in swipeMarkers" :key="'swipe-' + mark.id" class="swipe-group">
                <div
                    class="swipe-dot swipe-start"
                    :style="{ left: mark.x1Pct + '%', top: mark.y1Pct + '%' }"
                ></div>
                <div
                    class="swipe-dot swipe-end"
                    :style="{ left: mark.x2Pct + '%', top: mark.y2Pct + '%' }"
                >
                    <span class="swipe-label">S{{ mark.label }}</span>
                </div>
            </div>
            <template v-if="showOcrBlocks && ocrBlocks.length > 0">
                <div
                    v-for="(block, bi) in ocrBlocks"
                    :key="bi"
                    class="ocr-block"
                    :class="{ selected: selectedOcrBlock === bi }"
                    :style="ocrBlockStyle(block)"
                    :title="block.text"
                    @click.stop="emit('pickOcrBlock', bi)"
                >
                    <span class="ocr-block-label">{{ block.text }}</span>
                </div>
            </template>
        </div>
        <div v-else class="placeholder">Capture a screenshot to pick coordinates</div>
    </div>
</template>

<script setup lang="ts">
    import { ref, computed, watch } from 'vue'
    import type { Step } from '../lib/workflow'

    interface WindowInfo {
        id: number
        title: string
    }

    interface OcrBlock {
        text: string
        bbox: { x0: number; y0: number; x1: number; y1: number }
    }

    interface Marker {
        id: string
        xPct: number
        yPct: number
        x: number
        y: number
        label: string
    }

    interface SwipeMarker {
        id: string
        x1Pct: number
        y1Pct: number
        x2Pct: number
        y2Pct: number
        label: string
    }

    const props = defineProps<{
        windows: WindowInfo[]
        selectedHandle: number | null
        screenshotSrc: string
        screenshotWindow: any
        captureWidth: number
        captureHeight: number
        steps: Step[]
        showOcrBlocks: boolean
        ocrBlocks: OcrBlock[]
        selectedOcrBlock: number | null
        pickHint: string
        isPicking: boolean
        hoverCoord: { x: number; y: number } | null
        disabled?: boolean
    }>()

    const emit = defineEmits<{
        'update:selectedHandle': [handle: number | null]
        refreshWindows: []
        capture: []
        toggleOcrBlocks: []
        pickOcrBlock: [index: number]
        screenshotClick: [coord: { x: number; y: number }]
        imageLoad: [dim: { width: number; height: number }]
        imageHover: [coord: { x: number; y: number } | null]
        hoverClear: []
    }>()

    const imgRef = ref<HTMLImageElement | null>(null)
    const imgWrapperRef = ref<HTMLDivElement | null>(null)
    const localHandle = ref(props.selectedHandle)

    watch(
        () => props.selectedHandle,
        (val) => {
            localHandle.value = val
        },
    )

    watch(localHandle, (val) => {
        emit('update:selectedHandle', val)
    })

    const xyMarkers = computed<Marker[]>(() => {
        return props.steps
            .filter((s: Step) => s.type === 'clickXY' && s.x != null && s.y != null)
            .map((s: Step) => {
                const idx = props.steps.indexOf(s)
                if (props.captureWidth === 0)
                    return {
                        id: s.id,
                        xPct: 0,
                        yPct: 0,
                        x: s.x ?? 0,
                        y: s.y ?? 0,
                        label: `${idx + 1}`,
                    }
                return {
                    id: s.id,
                    xPct: ((s.x ?? 0) / props.captureWidth) * 100,
                    yPct: ((s.y ?? 0) / props.captureHeight) * 100,
                    x: s.x ?? 0,
                    y: s.y ?? 0,
                    label: `${idx + 1}`,
                }
            })
    })

    const swipeMarkers = computed<SwipeMarker[]>(() => {
        return props.steps
            .filter(
                (s: Step) =>
                    s.type === 'swipe' &&
                    s.x1 != null &&
                    s.y1 != null &&
                    s.x2 != null &&
                    s.y2 != null,
            )
            .map((s: Step) => {
                const idx = props.steps.indexOf(s)
                if (props.captureWidth === 0)
                    return { id: s.id, x1Pct: 0, y1Pct: 0, x2Pct: 0, y2Pct: 0, label: `${idx + 1}` }
                return {
                    id: s.id,
                    x1Pct: ((s.x1 ?? 0) / props.captureWidth) * 100,
                    y1Pct: ((s.y1 ?? 0) / props.captureHeight) * 100,
                    x2Pct: ((s.x2 ?? 0) / props.captureWidth) * 100,
                    y2Pct: ((s.y2 ?? 0) / props.captureHeight) * 100,
                    label: `${idx + 1}`,
                }
            })
    })

    function imageCoord(e: MouseEvent): { x: number; y: number } | null {
        const img = imgRef.value
        if (!img) return null
        const rect = img.getBoundingClientRect()
        return {
            x: Math.round((e.clientX - rect.left) * (img.naturalWidth / Math.max(rect.width, 1))),
            y: Math.round((e.clientY - rect.top) * (img.naturalHeight / Math.max(rect.height, 1))),
        }
    }

    function onImgClick(e: MouseEvent) {
        const coord = imageCoord(e)
        if (coord) emit('screenshotClick', coord)
    }

    function onImgHover(e: MouseEvent) {
        const coord = imageCoord(e)
        if (coord) emit('imageHover', coord)
    }

    function onImgLoad(event: Event) {
        const target = event.target as HTMLImageElement
        emit('imageLoad', { width: target.naturalWidth, height: target.naturalHeight })
    }

    function ocrBlockStyle(block: OcrBlock): Record<string, string> {
        if (props.captureWidth === 0 || props.captureHeight === 0) return {}
        return {
            left: (block.bbox.x0 / props.captureWidth) * 100 + '%',
            top: (block.bbox.y0 / props.captureHeight) * 100 + '%',
            width: ((block.bbox.x1 - block.bbox.x0) / props.captureWidth) * 100 + '%',
            height: ((block.bbox.y1 - block.bbox.y0) / props.captureHeight) * 100 + '%',
        }
    }
</script>

<style scoped>
    .screenshot-area {
        border: 1px solid #2a2a2a;
        border-radius: 4px;
        overflow: hidden;
    }
    .screenshot-area .toolbar {
        display: flex;
        align-items: center;
        padding: 8px;
        border-bottom: 1px solid #2a2a2a;
    }
    .screenshot-area .toolbar h3 {
        font-size: 13px;
        color: #e94560;
        margin: 0;
    }
    .screenshot-area .toolbar .window-select {
        flex: 1;
        margin: 0 8px;
        font-size: 11px;
        padding: 2px 4px;
        background: #1e1e1e;
        color: #ececec;
        border: 1px solid #2a2a2a;
        border-radius: 3px;
        max-width: 300px;
    }
    .screenshot-area .toolbar .window-select:disabled {
        opacity: 0.5;
    }
    .screenshot-area .toolbar button {
        flex-shrink: 0;
    }
    button.small {
        background: #1e1e1e;
        color: #ececec;
        border: 1px solid #2a2a2a;
        padding: 3px 10px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
    }
    button.small:disabled {
        opacity: 0.4;
    }
    .capture-btn {
        background: #2e7d32 !important;
        color: #fff !important;
        border-color: #2e7d32 !important;
    }
    .capture-btn:disabled {
        opacity: 0.4 !important;
    }
    .window-label {
        font-size: 11px;
        color: #6b7280;
        padding: 4px 8px;
        border-bottom: 1px solid #2a2a2a;
    }
    .img-wrapper {
        position: relative;
        cursor: crosshair;
        display: inline-block;
        max-width: 100%;
        overflow: hidden;
    }
    .img-wrapper img {
        display: block;
        max-width: 100%;
        max-height: 70vh;
    }
    .xy-marker {
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: none;
        display: flex;
        align-items: center;
        gap: 3px;
    }
    .marker-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #e94560;
        border: 2px solid #fff;
        box-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
    }
    .marker-label {
        font-size: 10px;
        color: #fff;
        background: rgba(233, 69, 60, 0.8);
        padding: 1px 4px;
        border-radius: 3px;
        font-weight: bold;
    }
    .swipe-group {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }
    .swipe-dot {
        position: absolute;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        border: 2px solid #e94560;
    }
    .swipe-start {
        background: rgba(233, 69, 60, 0.15);
    }
    .swipe-end {
        background: #e94560;
    }
    .swipe-label {
        position: absolute;
        top: -16px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 9px;
        color: #e94560;
        font-weight: bold;
        white-space: nowrap;
    }
    .placeholder {
        padding: 60px 20px;
        text-align: center;
        color: #4b5563;
        font-size: 13px;
    }
    .pick-hint {
        background: #e94560;
        color: #fff;
        text-align: center;
        padding: 4px;
        font-size: 11px;
        display: flex;
        justify-content: center;
        gap: 12px;
    }
    .hover-coord {
        color: #ffd54f;
        font-weight: bold;
    }
    .blocks-btn {
        margin-left: 6px;
        flex-shrink: 0;
    }
    .blocks-btn.active {
        background: #7b1fa2;
        border-color: #7b1fa2;
        color: #fff;
    }
    .blocks-btn:disabled {
        opacity: 0.5;
    }
    .ocr-block {
        position: absolute;
        border: 2px solid #7b1fa2;
        background: rgba(123, 31, 162, 0.15);
        cursor: pointer;
        box-sizing: border-box;
    }
    .ocr-block:hover {
        border-color: #ce93d8;
        background: rgba(123, 31, 162, 0.3);
    }
    .ocr-block.selected {
        border-color: #ffd54f;
        background: rgba(255, 213, 79, 0.25);
    }
    .ocr-block-label {
        position: absolute;
        top: -14px;
        left: 0;
        font-size: 9px;
        color: #fff;
        background: #7b1fa2;
        padding: 1px 3px;
        border-radius: 2px;
        white-space: nowrap;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>
