<template>
    <div class="screenshot-area">
        <div class="toolbar">
            <div class="toolbar-left">
                <h3>Screenshot Preview</h3>
                <span v-if="screenshotWindow" class="window-label-badge">
                    {{ screenshotWindow.title }}
                </span>
            </div>

            <div class="toolbar-controls">
                <button
                    v-if="configuredResolution"
                    class="btn btn-secondary btn-small"
                    @click="emit('resizeTargetWindow')"
                    :disabled="disabled"
                    title="Resize target window to original size"
                >
                    📐 Resize Window ({{ configuredResolution.width }}x{{
                        configuredResolution.height
                    }})
                </button>
                <button
                    class="btn btn-blocks btn-small"
                    @click="emit('toggleOcrBlocks')"
                    :disabled="!screenshotSrc || disabled"
                    :class="{ active: showOcrBlocks }"
                >
                    {{ showOcrBlocks ? '🙈 Hide Blocks' : '👁️ Show Blocks' }}
                </button>
            </div>
        </div>

        <div v-if="pickHint" class="pick-hint active-picking">
            <div class="pick-hint-left">
                <span class="picking-pulse"></span>
                <span class="hint-text">💡 {{ pickHint }}</span>
            </div>
            <span v-if="hoverCoord" class="hover-coord">
                Coords:
                <strong class="glow-yellow">X: {{ hoverCoord.x }}, Y: {{ hoverCoord.y }}</strong>
            </span>
        </div>

        <div class="canvas-container">
            <div
                v-if="screenshotSrc"
                class="img-wrapper"
                ref="imgWrapperRef"
                @click="onImgClick"
                @mousemove="onImgHover"
                @mouseleave="emit('hoverClear')"
            >
                <img :src="screenshotSrc" draggable="false" ref="imgRef" @load="onImgLoad" />

                <!-- Coordinate Target Markers -->
                <div
                    v-for="mark in xyMarkers"
                    :key="mark.id"
                    class="xy-marker"
                    :class="{
                        active: isStepActive(mark.index),
                        running: isStepRunning(mark.index),
                        inactive: !isStepActive(mark.index),
                    }"
                    :style="{ left: mark.xPct + '%', top: mark.yPct + '%' }"
                    :title="'Step ' + mark.label + ' (' + mark.x + ', ' + mark.y + ')'"
                >
                    <span class="marker-crosshair"></span>
                    <span class="marker-dot"></span>
                    <span class="marker-label">{{ mark.label }}</span>
                </div>

                <!-- Swipe SVG Path Overlay -->
                <svg class="swipe-svg-overlay" v-if="swipeMarkers.length > 0">
                    <defs>
                        <marker
                            id="arrow"
                            viewBox="0 0 10 10"
                            refX="6"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                        >
                            <path d="M 0 2 L 10 5 L 0 8 z" fill="var(--color-accent)" />
                        </marker>
                        <marker
                            id="arrow-running"
                            viewBox="0 0 10 10"
                            refX="6"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                        >
                            <path d="M 0 2 L 10 5 L 0 8 z" fill="var(--color-warning)" />
                        </marker>
                    </defs>
                    <line
                        v-for="mark in swipeMarkers"
                        :key="'line-' + mark.id"
                        :x1="mark.x1Pct + '%'"
                        :y1="mark.y1Pct + '%'"
                        :x2="mark.x2Pct + '%'"
                        :y2="mark.y2Pct + '%'"
                        :class="{
                            active: isStepActive(mark.index),
                            running: isStepRunning(mark.index),
                            inactive: !isStepActive(mark.index),
                        }"
                        stroke-width="2.5"
                        stroke-dasharray="5,4"
                    />
                </svg>

                <!-- Swipe Path Markers -->
                <div v-for="mark in swipeMarkers" :key="'swipe-' + mark.id" class="swipe-group">
                    <div
                        class="swipe-dot swipe-start"
                        :class="{
                            active: isStepActive(mark.index),
                            running: isStepRunning(mark.index),
                            inactive: !isStepActive(mark.index),
                        }"
                        :style="{ left: mark.x1Pct + '%', top: mark.y1Pct + '%' }"
                    ></div>
                    <div
                        class="swipe-dot swipe-end"
                        :class="{
                            active: isStepActive(mark.index),
                            running: isStepRunning(mark.index),
                            inactive: !isStepActive(mark.index),
                        }"
                        :style="{ left: mark.x2Pct + '%', top: mark.y2Pct + '%' }"
                    >
                        <span
                            class="swipe-label"
                            :class="{
                                active: isStepActive(mark.index),
                                running: isStepRunning(mark.index),
                                inactive: !isStepActive(mark.index),
                            }"
                        >
                            S{{ mark.label }}
                        </span>
                    </div>
                </div>

                <!-- OCR Blocks highlights -->
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
                <span>Select a window and capture a screenshot to visually set coordinates.</span>
            </div>
        </div>
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
        index: number
    }

    interface SwipeMarker {
        id: string
        x1Pct: number
        y1Pct: number
        x2Pct: number
        y2Pct: number
        label: string
        index: number
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
        configuredResolution?: { width: number; height: number } | null
        disabled?: boolean
        selectedStepIdx?: number | null
        hoveredStepIdx?: number | null
        currentStepIdx?: number | null
        pickingCoordIdx?: number | null
        pickingSwipeIdx?: number | null
        ocrWidth?: number
        ocrHeight?: number
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
        resizeTargetWindow: []
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
                        index: idx,
                    }
                return {
                    id: s.id,
                    xPct: ((s.x ?? 0) / props.captureWidth) * 100,
                    yPct: ((s.y ?? 0) / props.captureHeight) * 100,
                    x: s.x ?? 0,
                    y: s.y ?? 0,
                    label: `${idx + 1}`,
                    index: idx,
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
                    return {
                        id: s.id,
                        x1Pct: 0,
                        y1Pct: 0,
                        x2Pct: 0,
                        y2Pct: 0,
                        label: `${idx + 1}`,
                        index: idx,
                    }
                return {
                    id: s.id,
                    x1Pct: ((s.x1 ?? 0) / props.captureWidth) * 100,
                    y1Pct: ((s.y1 ?? 0) / props.captureHeight) * 100,
                    x2Pct: ((s.x2 ?? 0) / props.captureWidth) * 100,
                    y2Pct: ((s.y2 ?? 0) / props.captureHeight) * 100,
                    label: `${idx + 1}`,
                    index: idx,
                }
            })
    })

    function isStepActive(stepIdx: number): boolean {
        return (
            props.hoveredStepIdx === stepIdx ||
            props.selectedStepIdx === stepIdx ||
            props.currentStepIdx === stepIdx ||
            props.pickingCoordIdx === stepIdx ||
            props.pickingSwipeIdx === stepIdx
        )
    }

    function isStepRunning(stepIdx: number): boolean {
        return props.currentStepIdx === stepIdx
    }

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
        const w = props.ocrWidth || props.captureWidth
        const h = props.ocrHeight || props.captureHeight
        if (w === 0 || h === 0) return {}
        return {
            left: (block.bbox.x0 / w) * 100 + '%',
            top: (block.bbox.y0 / h) * 100 + '%',
            width: ((block.bbox.x1 - block.bbox.x0) / w) * 100 + '%',
            height: ((block.bbox.y1 - block.bbox.y0) / h) * 100 + '%',
        }
    }
</script>

<style scoped>
    .screenshot-area {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
        display: flex;
        flex-direction: column;
    }

    .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 20px;
        background: var(--bg-panel);
        border-bottom: 1px solid var(--border-color);
        gap: 16px;
    }

    .toolbar-left {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .toolbar-left h3 {
        font-size: 14px;
        font-weight: 700;
        color: var(--text-primary);
    }

    .window-label-badge {
        font-size: 11px;
        color: var(--color-accent);
        font-weight: 600;
        background: rgba(244, 63, 94, 0.08);
        border: 1px solid rgba(244, 63, 94, 0.2);
        padding: 2px 8px;
        border-radius: var(--radius-full);
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .toolbar-controls {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .select-wrapper {
        position: relative;
    }

    .custom-select {
        background: var(--bg-main);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 6px 20px 6px 10px;
        font-size: 12px;
        outline: none;
        appearance: none;
        cursor: pointer;
        transition: border-color var(--transition-fast);
        max-width: 200px;
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

    .custom-select:focus {
        border-color: var(--color-accent);
    }

    .custom-select:disabled {
        opacity: 0.4;
    }

    /* Buttons */
    .btn {
        padding: 6px 12px;
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

    .btn-secondary {
        background: var(--bg-main);
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
    }
    .btn-secondary:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.02);
        color: var(--text-primary);
    }

    .btn-capture {
        background: var(--color-success-gradient);
        color: white;
        box-shadow: 0 2px 6px rgba(16, 185, 129, 0.15);
    }
    .btn-capture:hover:not(:disabled) {
        opacity: 0.9;
        transform: translateY(-0.5px);
    }

    .btn-blocks {
        background: rgba(139, 92, 246, 0.1);
        border: 1px solid rgba(139, 92, 246, 0.2);
        color: #a78bfa;
    }
    .btn-blocks:hover:not(:disabled) {
        background: rgba(139, 92, 246, 0.2);
        color: #c4b5fd;
    }
    .btn-blocks.active {
        background: #8b5cf6;
        color: white;
        box-shadow: 0 0 10px rgba(139, 92, 246, 0.3);
    }

    .btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .pick-hint {
        background: var(--color-accent);
        color: #fff;
        text-align: center;
        padding: 10px 20px;
        font-size: 12px;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
        animation: slideDown 0.2s ease-out;
        box-shadow: 0 2px 10px rgba(244, 63, 94, 0.3);
    }

    .pick-hint.active-picking {
        background: linear-gradient(90deg, #f43f5e 0%, #ec4899 100%);
        border-bottom: 2px solid rgba(255, 255, 255, 0.1);
    }

    .pick-hint-left {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .picking-pulse {
        width: 8px;
        height: 8px;
        background: #fff;
        border-radius: 50%;
        box-shadow: 0 0 8px #fff;
        animation: pulse-ring 1.2s infinite;
    }

    .hover-coord {
        background: rgba(0, 0, 0, 0.3);
        padding: 2px 8px;
        border-radius: var(--radius-sm);
    }

    .glow-yellow {
        color: #fcd34d;
        font-family: var(--font-mono);
    }

    .canvas-container {
        padding: 16px;
        background: #09090b;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .img-wrapper {
        position: relative;
        cursor: crosshair;
        display: inline-block;
        max-width: 100%;
        overflow: hidden;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-color);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    }

    .img-wrapper img {
        display: block;
        max-width: 100%;
        max-height: 60vh;
        user-select: none;
    }

    /* Target Crosshair Markers */
    .xy-marker {
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all var(--transition-fast);
    }

    .xy-marker.inactive {
        opacity: 0.15;
    }

    .marker-crosshair {
        position: absolute;
        width: 24px;
        height: 24px;
        border: 1px dashed var(--color-accent);
        border-radius: 50%;
        animation: rotateGlow 8s linear infinite;
        transition: all var(--transition-fast);
    }

    .xy-marker.inactive .marker-crosshair {
        opacity: 0;
        transform: scale(0.5);
    }

    .xy-marker.running .marker-crosshair {
        border-color: var(--color-warning);
    }

    .marker-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--color-accent);
        border: 2px solid white;
        box-shadow: 0 0 10px rgba(244, 63, 94, 0.8);
        animation: marker-pulse 2s infinite;
        transition: all var(--transition-fast);
    }

    .xy-marker.inactive .marker-dot {
        animation: none;
        box-shadow: none;
    }

    .xy-marker.running .marker-dot {
        background: var(--color-warning);
        box-shadow: 0 0 10px rgba(245, 158, 11, 0.8);
        animation: marker-pulse-running 2s infinite;
    }

    .marker-label {
        position: absolute;
        top: -18px;
        font-size: 10px;
        color: #fff;
        background: var(--color-accent);
        padding: 1px 6px;
        border-radius: var(--radius-sm);
        font-weight: 800;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        transition: all var(--transition-fast);
    }

    .xy-marker.inactive .marker-label {
        opacity: 0;
        transform: translateY(4px);
    }

    .xy-marker.running .marker-label {
        background: var(--color-warning);
        color: #000;
    }

    /* Swipe Paths Overlay */
    .swipe-svg-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 4;
    }

    .swipe-svg-overlay line {
        stroke: var(--color-accent);
        marker-end: url(#arrow);
        transition: all var(--transition-fast);
    }

    .swipe-svg-overlay line.running {
        stroke: var(--color-warning);
        marker-end: url(#arrow-running);
    }

    .swipe-svg-overlay line.inactive {
        opacity: 0.15;
    }

    .swipe-group {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    .swipe-dot {
        position: absolute;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        border: 2px solid var(--color-accent);
        box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
        transition: all var(--transition-fast);
    }

    .swipe-dot.inactive {
        opacity: 0.15;
    }

    .swipe-dot.running {
        border-color: var(--color-warning);
    }

    .swipe-start {
        background: rgba(244, 63, 94, 0.25);
    }

    .swipe-start.running {
        background: rgba(245, 158, 11, 0.25);
    }

    .swipe-end {
        background: var(--color-accent);
    }

    .swipe-end.running {
        background: var(--color-warning);
    }

    .swipe-label {
        position: absolute;
        bottom: -16px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 9px;
        color: var(--color-accent);
        background: var(--bg-main);
        border: 1px solid var(--color-accent);
        border-radius: 3px;
        padding: 1px 3px;
        font-weight: 800;
        white-space: nowrap;
        transition: all var(--transition-fast);
    }

    .swipe-label.inactive {
        opacity: 0;
    }

    .swipe-label.running {
        color: var(--color-warning);
        border-color: var(--color-warning);
    }

    /* OCR blocks overlays */
    .ocr-block {
        position: absolute;
        border: 1px solid rgba(139, 92, 246, 0.6);
        background: rgba(139, 92, 246, 0.08);
        cursor: pointer;
        box-sizing: border-box;
        border-radius: 2px;
        transition: all var(--transition-fast);
    }

    .ocr-block:hover {
        border-color: #a78bfa;
        background: rgba(139, 92, 246, 0.2);
    }

    .ocr-block.selected {
        border-color: #fcd34d;
        background: rgba(252, 211, 77, 0.18);
        box-shadow: 0 0 8px rgba(252, 211, 77, 0.3);
        z-index: 5;
    }

    .ocr-block-label {
        position: absolute;
        top: -16px;
        left: 0;
        font-size: 9px;
        font-weight: 700;
        color: #fff;
        background: #7c3aed;
        padding: 1px 4px;
        border-radius: var(--radius-sm);
        white-space: nowrap;
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        opacity: 0;
        transform: translateY(2px);
        transition: all var(--transition-fast);
        pointer-events: none;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .ocr-block:hover .ocr-block-label,
    .ocr-block.selected .ocr-block-label {
        opacity: 1;
        transform: translateY(0);
    }

    .placeholder {
        padding: 80px 20px;
        text-align: center;
        color: var(--text-muted);
        font-size: 13px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        border: 1px dashed var(--border-color);
        border-radius: var(--radius-lg);
        width: 100%;
        max-width: 500px;
        margin: 20px;
    }

    .placeholder-icon {
        width: 40px;
        height: 40px;
        color: var(--border-color);
    }

    @keyframes rotateGlow {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    @keyframes slideDown {
        from {
            transform: translateY(-100%);
        }
        to {
            transform: translateY(0);
        }
    }

    @keyframes marker-pulse {
        0%,
        100% {
            box-shadow: 0 0 6px rgba(244, 63, 94, 0.8);
            transform: scale(1);
        }
        50% {
            box-shadow:
                0 0 14px rgba(244, 63, 94, 1),
                0 0 20px rgba(244, 63, 94, 0.4);
            transform: scale(1.15);
        }
    }

    @keyframes marker-pulse-running {
        0%,
        100% {
            box-shadow: 0 0 6px rgba(245, 158, 11, 0.8);
            transform: scale(1);
        }
        50% {
            box-shadow:
                0 0 14px rgba(245, 158, 11, 1),
                0 0 20px rgba(245, 158, 11, 0.4);
            transform: scale(1.15);
        }
    }
</style>
