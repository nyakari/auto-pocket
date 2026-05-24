<template>
    <div class="pane">
        <div class="editor-layout">
            <div class="editor-left">
                <div class="editor-left-top">
                    <!-- Compact Workflow Selector & Action Bar -->
                    <div class="workflow-selector-bar">
                        <div class="select-wrapper">
                            <select
                                v-model="selectedWfName"
                                @change="onLoadSelectedWorkflow"
                                :disabled="running"
                                class="custom-select-wf"
                            >
                                <option value="" disabled>-- Load Workflow --</option>
                                <option
                                    v-for="wf in savedWorkflows"
                                    :key="wf.name"
                                    :value="wf.name"
                                >
                                    {{ wf.name }}
                                </option>
                            </select>
                        </div>
                        <input
                            v-model="workflowName"
                            placeholder="Workflow name..."
                            class="workflow-name-input"
                            :disabled="running"
                        />
                        <button
                            class="btn-wf-action"
                            @click="saveWorkflow"
                            :disabled="running"
                            title="Save Workflow"
                        >
                            💾
                        </button>
                        <button
                            class="btn-wf-action"
                            @click="createNewWorkflow"
                            :disabled="running"
                            title="New Workflow"
                        >
                            ➕
                        </button>
                    </div>

                    <div class="actions-row">
                        <button v-if="!running" class="start" @click="runWorkflow()">
                            Run Workflow
                        </button>
                        <button v-else class="stop" @click="stopWorkflow">Stop</button>
                    </div>
                </div>
                <div class="editor-left-scroll" ref="editorScrollRef">
                    <div class="section">
                        <div class="section-header">
                            <label>Steps</label>
                        </div>
                        <div v-if="steps.length === 0" class="no-items">No steps yet.</div>
                        <StepCard
                            v-for="(step, i) in steps"
                            :key="step.id"
                            :step="step"
                            :step-index="i"
                            :all-steps="steps"
                            :is-selected="selectedStepIdx === i"
                            :is-current-step="running && currentStepIdx === i"
                            :is-done-step="running && currentStepIdx! > i"
                            :is-picking-coords="pickingCoordIdx === i"
                            :is-picking-swipe="pickingSwipeIdx === i"
                            :use-scrcpy="props.useScrcpy"
                            :progress="workflowProgress"
                            :disabled="running"
                            :saved-workflows="savedWorkflows"
                            @select="selectedStepIdx = i"
                            @remove="removeStep(i)"
                            @run-from="runFromHere(i)"
                            @duplicate="duplicateStep(i)"
                            @start-picking-coords="startPickingCoords(i)"
                            @start-picking-swipe="startPickingSwipe(i)"
                            @hover="
                                (isHovered) => {
                                    hoveredStepIdx = isHovered ? i : null
                                }
                            "
                        />
                        <button class="small add-step-btn" @click="addStep" :disabled="running">
                            + Add Step
                        </button>
                    </div>
                </div>
            </div>

            <div class="editor-right">
                <!-- Embedded Tabs for Screenshot Editor and OCR Live Viewer -->
                <div class="right-tabs">
                    <button
                        class="tab-btn"
                        :class="{ active: rightTab === 'screenshot' }"
                        @click="rightTab = 'screenshot'"
                    >
                        📸 Screenshot Editor
                    </button>
                    <button
                        class="tab-btn"
                        :class="{ active: rightTab === 'ocr' }"
                        @click="rightTab = 'ocr'"
                    >
                        👁️ Live OCR Inspector
                    </button>
                </div>

                <div v-show="rightTab === 'screenshot'" class="screenshot-wrapper">
                    <ScreenshotPanel
                        :windows="windows"
                        :selected-handle="selectedHandle"
                        :screenshot-src="screenshotSrc"
                        :screenshot-window="screenshotWindow"
                        :capture-width="captureWidth"
                        :capture-height="captureHeight"
                        :steps="steps"
                        :show-ocr-blocks="showOcrBlocks"
                        :ocr-blocks="ocrBlocks"
                        :selected-ocr-block="selectedOcrBlock"
                        :pick-hint="pickHint"
                        :is-picking="pickingCoordIdx !== null || pickingSwipeIdx !== null"
                        :hover-coord="hoverCoord"
                        :disabled="running"
                        :configured-resolution="loadedWfDimensions"
                        :selected-step-idx="selectedStepIdx"
                        :hovered-step-idx="hoveredStepIdx"
                        :current-step-idx="currentStepIdx"
                        :picking-coord-idx="pickingCoordIdx"
                        :picking-swipe-idx="pickingSwipeIdx"
                        :ocr-width="ocrWidth"
                        :ocr-height="ocrHeight"
                        @update:selected-handle="emit('update:selectedHandle', $event)"
                        @refresh-windows="emit('refreshWindows')"
                        @toggle-ocr-blocks="toggleOcrBlocks"
                        @pick-ocr-block="pickOcrBlock"
                        @screenshot-click="onScreenshotClick"
                        @image-load="onImageLoad"
                        @image-hover="hoverCoord = $event"
                        @hover-clear="hoverCoord = null"
                        @resize-target-window="resizeTargetWindow"
                    />
                </div>

                <div v-show="rightTab === 'ocr'" class="ocr-tab-container">
                    <OcrViewer
                        :windows="windows"
                        :selected-handle="selectedHandle"
                        @log="(level, msg) => emit('log', level, msg)"
                    />
                </div>

                <div class="bottom-console" :class="{ collapsed: isConsoleCollapsed }">
                    <div
                        class="console-toggle-bar"
                        @click="isConsoleCollapsed = !isConsoleCollapsed"
                    >
                        <span class="console-indicator">⚙️ Developer Console</span>
                        <span class="console-badge" v-if="logLines.length > 0"
                            >{{ logLines.length }} lines</span
                        >
                        <span class="console-arrow">{{
                            isConsoleCollapsed ? '▲ Expand Logs' : '▼ Collapse'
                        }}</span>
                    </div>
                    <div v-show="!isConsoleCollapsed" class="console-content">
                        <ActionLog :lines="logLines" @clear="emit('clearLogs')" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
    import StepCard from './StepCard.vue'
    import ScreenshotPanel from './ScreenshotPanel.vue'
    import ActionLog from './ActionLog.vue'
    import OcrViewer from './OcrViewer.vue'
    import {
        stepSummary,
        createStep,
        moveStep,
        resolveStepIndex,
        type Step,
        type SavedWorkflow,
        type WorkflowProgress,
    } from '../lib/workflow'
    import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
    import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
    import { reorderWithEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge'
    import { triggerPostMoveFlash } from '@atlaskit/pragmatic-drag-and-drop-flourish/trigger-post-move-flash'
    import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element'

    const props = defineProps<{
        windows: any[]
        selectedHandle: number | null
        useScrcpy: boolean
        adbPath: string
        logLines: Array<{ time: string; level: string; msg: string }>
    }>()

    const emit = defineEmits<{
        'update:selectedHandle': [handle: number | null]
        refreshWindows: []
        clearLogs: []
        log: [level: string, msg: string]
    }>()

    const screenshotSrc = ref('')
    const screenshotWindow = ref<any>(null)
    const captureWidth = ref(0)
    const captureHeight = ref(0)
    const isConsoleCollapsed = ref(true)
    const rightTab = ref<'screenshot' | 'ocr'>('screenshot')
    const selectedWfName = ref('')
    const loadedWfDimensions = ref<{ width: number; height: number } | null>(null)

    const ocrWidth = ref(0)
    const ocrHeight = ref(0)
    let livePreviewTimer: ReturnType<typeof setInterval> | null = null

    const isLivePreviewActive = computed(() => {
        return props.selectedHandle !== null && rightTab.value === 'screenshot' && !running.value
    })

    async function captureScreenshotSilently() {
        if (!props.selectedHandle) return
        try {
            const result = await window.api.captureWindow(props.selectedHandle)
            screenshotWindow.value = result.window
            screenshotSrc.value = `data:image/png;base64,${result.image}`
        } catch (e) {
            // Ignore capture errors during silent live preview to prevent console spam
        }
    }

    function startLivePreview() {
        stopLivePreview()
        if (!isLivePreviewActive.value) return
        void captureScreenshotSilently()
        livePreviewTimer = setInterval(() => {
            void captureScreenshotSilently()
        }, 1000)
    }

    function stopLivePreview() {
        if (livePreviewTimer) {
            clearInterval(livePreviewTimer)
            livePreviewTimer = null
        }
    }

    watch(
        isLivePreviewActive,
        (active) => {
            if (active) {
                startLivePreview()
            } else {
                stopLivePreview()
            }
        },
        { immediate: true },
    )

    const workflowName = ref('')
    const savedWorkflows = ref<SavedWorkflow[]>([])
    const steps = ref<Step[]>([])
    const selectedStepIdx = ref<number | null>(null)
    const pickingCoordIdx = ref<number | null>(null)
    const pickingSwipeIdx = ref<number | null>(null)
    const swipePickPhase = ref<'start' | 'end' | null>(null)
    const running = ref(false)
    const currentStepIdx = ref(-1)
    const hoverCoord = ref<{ x: number; y: number } | null>(null)
    const hoveredStepIdx = ref<number | null>(null)
    const runFromHereIdx = ref<number | null>(null)

    const ocrBlocks = ref<any[]>([])
    const showOcrBlocks = ref(false)
    const selectedOcrBlock = ref<number | null>(null)
    const workflowProgress = ref<WorkflowProgress | null>(null)
    const workflowGen = ref(0)

    const defaultWaitMs = ref(0.5)
    const deviceResolution = ref({ width: 0, height: 0 })
    const editorScrollRef = ref<HTMLDivElement | null>(null)

    watch(
        () => props.useScrcpy,
        (val) => {
            if (val && deviceResolution.value.width === 0) {
                detectResolution()
            }
        },
        { immediate: true },
    )

    const pickHint = computed(() => {
        if (pickingCoordIdx.value !== null) {
            return `Click on the image to set coordinates for step ${pickingCoordIdx.value + 1}`
        }
        if (pickingSwipeIdx.value !== null) {
            if (swipePickPhase.value === 'start') {
                return `Click start point for swipe (step ${pickingSwipeIdx.value + 1})`
            }
            return `Click end point for swipe (step ${pickingSwipeIdx.value + 1})`
        }
        return ''
    })

    async function browseAdb() {
        const result = await window.api.selectAdb()
        if (result) adbPath.value = result
    }

    async function detectResolution() {
        try {
            const res = await window.api.getDeviceResolution(props.adbPath)
            if (res.width && res.height) {
                deviceResolution.value = res
                emit('log', 'info', `Device resolution: ${res.width}x${res.height}`)
            } else {
                emit('log', 'warn', 'Could not detect device resolution - is adb connected?')
            }
        } catch (e: any) {
            emit('log', 'error', `Failed to detect device: ${e.message}`)
        }
    }

    function addStep() {
        steps.value.push(createStep(defaultWaitMs.value))
        selectedStepIdx.value = steps.value.length - 1
    }

    function removeStep(i: number) {
        steps.value.splice(i, 1)
        if (selectedStepIdx.value === i) selectedStepIdx.value = null
        else if (selectedStepIdx.value! > i) selectedStepIdx.value!--
    }

    function duplicateStep(i: number) {
        const original = steps.value[i]
        const copy = JSON.parse(JSON.stringify(original))
        copy.id = crypto.randomUUID()
        steps.value.splice(i + 1, 0, copy)
        selectedStepIdx.value = i + 1
        emit('log', 'info', `Duplicated step ${i + 1}`)
    }

    function moveStepUp(i: number) {
        if (i <= 0) return
        steps.value = moveStep(steps.value, i, i - 1)
        if (selectedStepIdx.value === i) {
            selectedStepIdx.value = i - 1
        } else if (selectedStepIdx.value === i - 1) {
            selectedStepIdx.value = i
        }
    }

    function moveStepDown(i: number) {
        if (i >= steps.value.length - 1) return
        steps.value = moveStep(steps.value, i, i + 1)
        if (selectedStepIdx.value === i) {
            selectedStepIdx.value = i + 1
        } else if (selectedStepIdx.value === i + 1) {
            selectedStepIdx.value = i
        }
    }

    function startPickingCoords(i: number) {
        pickingCoordIdx.value = pickingCoordIdx.value === i ? null : i
        pickingSwipeIdx.value = null
        swipePickPhase.value = null
    }

    function startPickingSwipe(i: number) {
        if (pickingSwipeIdx.value === i) {
            pickingSwipeIdx.value = null
            swipePickPhase.value = null
            return
        }
        pickingCoordIdx.value = null
        pickingSwipeIdx.value = i
        swipePickPhase.value = 'start'
    }

    function onImageLoad(dim: { width: number; height: number }) {
        captureWidth.value = dim.width
        captureHeight.value = dim.height
    }

    function onScreenshotClick(coord: { x: number; y: number }) {
        if (pickingCoordIdx.value !== null) {
            const step = steps.value[pickingCoordIdx.value]
            if (step && step.type === 'clickXY') {
                step.x = coord.x
                step.y = coord.y
            }
            pickingCoordIdx.value = null
            hoverCoord.value = null
            return
        }

        if (pickingSwipeIdx.value !== null) {
            const step = steps.value[pickingSwipeIdx.value]
            if (step && step.type === 'swipe') {
                if (swipePickPhase.value === 'start') {
                    step.x1 = coord.x
                    step.y1 = coord.y
                    swipePickPhase.value = 'end'
                } else if (swipePickPhase.value === 'end') {
                    step.x2 = coord.x
                    step.y2 = coord.y
                    pickingSwipeIdx.value = null
                    swipePickPhase.value = null
                }
            } else {
                pickingSwipeIdx.value = null
                swipePickPhase.value = null
            }
            hoverCoord.value = null
            return
        }
    }

    async function refreshWindows() {
        emit('refreshWindows')
    }

    async function toggleOcrBlocks() {
        if (showOcrBlocks.value) {
            showOcrBlocks.value = false
            ocrBlocks.value = []
            selectedOcrBlock.value = null
            ocrWidth.value = 0
            ocrHeight.value = 0
            return
        }

        if (!props.selectedHandle) {
            emit('log', 'warn', 'Select a window first')
            return
        }

        try {
            emit('log', 'info', 'Capturing window for OCR...')
            const result = await window.api.captureWindow(props.selectedHandle)
            const b64 = result.image

            const img = new Image()
            img.src = `data:image/png;base64,${b64}`
            await new Promise((resolve) => {
                img.onload = resolve
                img.onerror = resolve
            })
            ocrWidth.value = img.naturalWidth
            ocrHeight.value = img.naturalHeight

            const ocrResult = await window.api.ocrImageWithLang(b64, 'en-US', 1)
            ocrBlocks.value = (ocrResult.blocks || []).map((b: any) => ({
                text: b.text,
                bbox: b.bbox,
            }))
            showOcrBlocks.value = true
            emit(
                'log',
                'info',
                `OCR found ${ocrBlocks.value.length} word blocks (${ocrWidth.value}x${ocrHeight.value})`,
            )
        } catch (e: any) {
            emit('log', 'error', `OCR failed: ${e.message || e}`)
            showOcrBlocks.value = false
            ocrBlocks.value = []
            ocrWidth.value = 0
            ocrHeight.value = 0
        }
    }

    function pickOcrBlock(bi: number) {
        selectedOcrBlock.value = selectedOcrBlock.value === bi ? null : bi
        const block = ocrBlocks.value[bi]
        if (!block) return
        const cx = Math.round((block.bbox.x0 + block.bbox.x1) / 2)
        const cy = Math.round((block.bbox.y0 + block.bbox.y1) / 2)

        if (pickingCoordIdx.value !== null) {
            const step = steps.value[pickingCoordIdx.value]
            if (step && step.type === 'clickXY') {
                step.x = cx
                step.y = cy
                pickingCoordIdx.value = null
                emit('log', 'info', `Set coords from block "${block.text}" at (${cx}, ${cy})`)
            }
            return
        }

        if (selectedStepIdx.value !== null) {
            const step = steps.value[selectedStepIdx.value]
            if (step && step.type === 'clickText') {
                step.when = block.text
                emit('log', 'info', `Set clickText to "${block.text}"`)
            }
        }
    }

    function onLoadWorkflow(name: string) {
        const wf = savedWorkflows.value.find((w: any) => w.name === name)
        if (wf) {
            workflowName.value = wf.name
            steps.value = JSON.parse(JSON.stringify(wf.steps))
            loadedWfDimensions.value =
                wf.windowWidth && wf.windowHeight
                    ? { width: wf.windowWidth, height: wf.windowHeight }
                    : null
            selectedStepIdx.value = null
            emit('log', 'info', `Loaded workflow "${wf.name}"`)
        }
    }

    function onLoadSelectedWorkflow() {
        if (selectedWfName.value) {
            onLoadWorkflow(selectedWfName.value)
            selectedWfName.value = ''
        }
    }

    function createNewWorkflow() {
        workflowName.value = 'New Workflow'
        steps.value = []
        selectedStepIdx.value = null
        loadedWfDimensions.value = null
        emit('log', 'info', 'Created new empty workflow')
    }

    async function saveWorkflow() {
        if (!workflowName.value.trim()) {
            emit('log', 'warn', 'Enter a workflow name before saving')
            return
        }
        try {
            const config = await window.api.loadConfig()
            const wf = JSON.parse(
                JSON.stringify({
                    name: workflowName.value.trim(),
                    steps: steps.value,
                    windowWidth: captureWidth.value || undefined,
                    windowHeight: captureHeight.value || undefined,
                }),
            )
            const existing = config.workflows || []
            const idx = existing.findIndex((w: any) => w.name === wf.name)
            if (idx >= 0) {
                existing[idx] = wf
            } else {
                existing.push(wf)
            }
            config.workflows = existing
            await window.api.saveConfig(config)
            savedWorkflows.value = existing
            loadedWfDimensions.value =
                wf.windowWidth && wf.windowHeight
                    ? { width: wf.windowWidth, height: wf.windowHeight }
                    : null
            emit('log', 'info', `Workflow "${wf.name}" saved`)
        } catch (e: any) {
            emit('log', 'error', `Failed to save workflow: ${e.message || e}`)
        }
    }

    function runFromHere(i: number) {
        runFromHereIdx.value = i
        runWorkflow()
    }

    async function runWorkflow() {
        if (steps.value.length === 0) {
            emit('log', 'warn', 'No steps in workflow')
            return
        }

        isConsoleCollapsed.value = false // Auto-expand logs console on run

        if (props.useScrcpy && deviceResolution.value.width === 0) {
            emit('log', 'info', 'Auto-detecting device resolution before run...')
            await detectResolution()
        }

        const si = runFromHereIdx.value !== null ? runFromHereIdx.value : 0
        runFromHereIdx.value = null

        const config = await window.api.loadConfig()
        config.targetWindowTitle = config.targetWindowTitle || (screenshotWindow.value?.title ?? '')
        config.useScrcpy = props.useScrcpy
        config.adbPath = props.adbPath
        config.deviceResolution = deviceResolution.value

        const dw = deviceResolution.value.width
        const dh = deviceResolution.value.height
        const scaleAdb =
            props.useScrcpy && dw > 0 && dh > 0 && captureWidth.value > 0 && captureHeight.value > 0

        const currentSteps = steps.value
        const workflow = {
            name: workflowName.value || 'Untitled',
            steps: currentSteps.map((s: Step) => {
                const step: any = {
                    ...s,
                    waitBeforeMs: (s.waitBeforeMs ?? defaultWaitMs.value) * 1000,
                }
                if (step.timeoutMs != null) step.timeoutMs *= 1000
                if (step.durationMs != null) step.durationMs *= 1000
                if (scaleAdb && step.type === 'clickXY' && step.x != null && step.y != null) {
                    step.x = Math.round(step.x * (dw / captureWidth.value))
                    step.y = Math.round(step.y * (dh / captureHeight.value))
                }
                if (scaleAdb && step.type === 'swipe') {
                    step.x1 = Math.round(step.x1 * (dw / captureWidth.value))
                    step.y1 = Math.round(step.y1 * (dh / captureHeight.value))
                    step.x2 = Math.round(step.x2 * (dw / captureWidth.value))
                    step.y2 = Math.round(step.y2 * (dh / captureHeight.value))
                }
                if (step.type === 'goto') {
                    const targetIdx = resolveStepIndex(
                        currentSteps,
                        step.targetStepId,
                        step.targetStep,
                    )
                    step.targetStep = targetIdx >= 0 ? targetIdx + 1 : (step.targetStep ?? 1)
                }
                if (step.type === 'condition' || step.type === 'checkVar') {
                    const thenIdx = resolveStepIndex(currentSteps, step.thenStepId, step.thenStep)
                    const elseIdx = resolveStepIndex(currentSteps, step.elseStepId, step.elseStep)
                    step.thenStep = thenIdx >= 0 ? thenIdx + 1 : (step.thenStep ?? 1)
                    if (step.elseStepId === '') {
                        step.elseStep = 0
                    } else {
                        step.elseStep = elseIdx >= 0 ? elseIdx + 1 : (step.elseStep ?? 0)
                    }
                }
                if (step.type === 'clickText' || step.type === 'captureLine') {
                    if (step.matchMode === 'last') step.matchIndex = -1
                    else if (step.matchMode === 'nth') {
                        const mn = step.matchN ?? 1
                        step.matchIndex = mn >= 1 ? mn - 1 : mn
                        emit(
                            'log',
                            'info',
                            `  matchMode=nth, matchN=${mn} → matchIndex=${step.matchIndex}`,
                        )
                    } else step.matchIndex = 0
                }
                return step
            }),
        }

        if (scaleAdb) {
            emit(
                'log',
                'info',
                `Scaled coordinates: screenshot ${captureWidth.value}x${captureHeight.value} → device ${dw}x${dh}`,
            )
        }

        running.value = true
        currentStepIdx.value = -1
        workflowProgress.value = null
        workflowGen.value++
        const stepCount = workflow.steps.length - si
        emit(
            'log',
            'info',
            `startIndex=${si}, total steps=${workflow.steps.length}, will run ${stepCount} steps`,
        )
        emit(
            'log',
            'info',
            `Workflow "${workflow.name}" started from step ${si + 1} (${stepCount} steps, ${props.useScrcpy ? 'scrcpy' : 'mouse'} mode)`,
        )

        try {
            await window.api.runWorkflow(
                JSON.parse(JSON.stringify(workflow)),
                JSON.parse(JSON.stringify(config)),
                si,
                workflowGen.value,
            )
        } catch (e: any) {
            emit('log', 'error', `Workflow failed to start: ${e.message || e}`)
            running.value = false
        }
    }

    async function stopWorkflow() {
        await window.api.stopWorkflow()
        running.value = false
        workflowProgress.value = null
        currentStepIdx.value = -1
        emit('log', 'info', 'Workflow stopped')
    }

    async function resizeTargetWindow() {
        if (props.selectedHandle && loadedWfDimensions.value) {
            try {
                await window.api.resizeWindow(
                    props.selectedHandle,
                    loadedWfDimensions.value.width,
                    loadedWfDimensions.value.height,
                )
                emit(
                    'log',
                    'info',
                    `Resized target window ${props.selectedHandle} to original size (${loadedWfDimensions.value.width}x${loadedWfDimensions.value.height})`,
                )
            } catch (e: any) {
                emit('log', 'error', `Failed to resize window: ${e.message}`)
            }
        }
    }

    let globalCleanup = () => {}

    watch(currentStepIdx, (idx) => {
        if (idx < 0 || !running.value) return
        const step = steps.value[idx]
        if (!step) return
        const el = document.querySelector(`[data-step-id="${step.id}"]`)
        if (el && editorScrollRef.value) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
    })

    onMounted(async () => {
        const cleanStep = window.api.onWorkflowStep((data: any) => {
            currentStepIdx.value = data.stepIndex
            if (data.status === 'running') {
                workflowProgress.value = null
                if (props.selectedHandle) {
                    window.api
                        .captureWindow(props.selectedHandle)
                        .then((cap) => {
                            screenshotSrc.value = `data:image/png;base64,${cap.image}`
                            screenshotWindow.value = cap.window
                        })
                        .catch(() => {})
                }
                emit(
                    'log',
                    'info',
                    `  Step ${data.stepIndex + 1}: ${data.step.name || stepSummary(data.step, steps.value)}`,
                )
            } else if (data.status === 'success') {
                emit('log', 'match', `  Step ${data.stepIndex + 1} OK: ${data.message}`)
            } else if (data.status === 'error') {
                emit('log', 'error', `  Step ${data.stepIndex + 1} FAILED: ${data.message}`)
            }
        })
        const cleanProgress = window.api.onWorkflowProgress((data: any) => {
            if (data.runId !== workflowGen.value) return
            workflowProgress.value = { elapsed: data.elapsed, total: data.total, type: data.type }
        })
        const cleanDone = window.api.onWorkflowDone((data: any) => {
            running.value = false
            currentStepIdx.value = -1
            workflowProgress.value = null
            if (props.selectedHandle) {
                window.api
                    .captureWindow(props.selectedHandle)
                    .then((cap) => {
                        screenshotSrc.value = `data:image/png;base64,${cap.image}`
                        screenshotWindow.value = cap.window
                    })
                    .catch(() => {})
            }
            if (data.status === 'completed') {
                emit(
                    'log',
                    'info',
                    `Workflow "${data.workflowName}" completed (${data.completedSteps}/${data.totalSteps} steps)`,
                )
            } else if (data.status === 'stopped') {
                emit(
                    'log',
                    'warn',
                    `Workflow "${data.workflowName}" stopped (${data.completedSteps}/${data.totalSteps} steps)`,
                )
            } else if (data.status === 'error') {
                emit('log', 'error', `Workflow "${data.workflowName}" error: ${data.error}`)
            }
        })

        const cleanDragMonitor = monitorForElements({
            canMonitor({ source }) {
                return typeof (source.data as any).stepId === 'string'
            },
            onDrop({ location, source }) {
                const target = location.current.dropTargets[0]
                if (!target) return

                const sourceData = source.data as { stepId: string }
                const targetData = target.data as { stepId: string }

                const indexOfSource = steps.value.findIndex((s) => s.id === sourceData.stepId)
                const indexOfTarget = steps.value.findIndex((s) => s.id === targetData.stepId)

                if (indexOfTarget < 0 || indexOfSource < 0) return

                const closestEdgeOfTarget = extractClosestEdge(targetData)

                const newSteps = reorderWithEdge({
                    list: steps.value,
                    startIndex: indexOfSource,
                    indexOfTarget,
                    closestEdgeOfTarget,
                    axis: 'vertical',
                })

                steps.value = newSteps

                if (selectedStepIdx.value !== null) {
                    if (selectedStepIdx.value === indexOfSource) {
                        const newSelectedIndex = newSteps.findIndex(
                            (s) => s.id === sourceData.stepId,
                        )
                        selectedStepIdx.value = newSelectedIndex
                    } else {
                        const selectedStepId = steps.value[selectedStepIdx.value]?.id
                        if (selectedStepId) {
                            const newSelectedIndex = newSteps.findIndex(
                                (s) => s.id === selectedStepId,
                            )
                            selectedStepIdx.value = newSelectedIndex
                        }
                    }
                }

                const element = document.querySelector(`[data-step-id="${sourceData.stepId}"]`)
                if (element instanceof HTMLElement) {
                    triggerPostMoveFlash(element)
                }
            },
        })

        let cleanAutoScroll = () => {}
        if (editorScrollRef.value) {
            cleanAutoScroll = autoScrollForElements({
                element: editorScrollRef.value,
                canScroll: ({ source }) => {
                    return typeof (source.data as any).stepId === 'string'
                },
            })
        }

        globalCleanup = () => {
            cleanStep()
            cleanProgress()
            cleanDone()
            cleanDragMonitor()
            cleanAutoScroll()
        }

        emit('refreshWindows')

        const c = await window.api.loadConfig()
        savedWorkflows.value = c.workflows || []
        defaultWaitMs.value =
            c.defaultWaitMs > 60 ? Math.round(c.defaultWaitMs / 1000) : c.defaultWaitMs || 0.5
        if (savedWorkflows.value.length > 0) {
            const wf = savedWorkflows.value[0]
            workflowName.value = wf.name
            steps.value = JSON.parse(JSON.stringify(wf.steps))
            loadedWfDimensions.value =
                wf.windowWidth && wf.windowHeight
                    ? { width: wf.windowWidth, height: wf.windowHeight }
                    : null
        }
    })

    onUnmounted(() => {
        globalCleanup()
        stopLivePreview()
    })
</script>

<style scoped>
    .pane {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--bg-main);
    }
    .editor-layout {
        display: flex;
        flex: 1;
        overflow: hidden;
    }
    .editor-left {
        width: 480px;
        min-width: 480px;
        display: flex;
        flex-direction: column;
        min-height: 0;
        border-right: 1px solid var(--border-color);
        background: var(--bg-panel);
    }
    .editor-left-top {
        padding: 20px 20px 0;
        flex-shrink: 0;
    }
    .editor-left-scroll {
        padding: 0 20px 20px;
        overflow-y: auto;
        flex: 1;
        min-height: 0;
    }
    .editor-right {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        background: var(--bg-main);
    }
    .section {
        margin-bottom: 20px;
    }
    .section label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
        margin-bottom: 6px;
    }
    .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
    }
    .section-header label {
        margin: 0;
    }

    .small {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        padding: 6px 12px;
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: 11px;
        font-weight: 600;
        transition: all var(--transition-fast);
    }
    .small:hover {
        background: var(--bg-card-hover);
        border-color: var(--border-hover);
    }
    .small:disabled {
        opacity: 0.4;
    }
    .no-items {
        font-size: 13px;
        color: var(--text-muted);
        padding: 30px;
        text-align: center;
        border: 1px dashed var(--border-color);
        border-radius: var(--radius-md);
        margin-bottom: 12px;
    }
    .actions-row {
        padding: 8px 0 16px;
    }
    .actions-row button {
        width: 100%;
        padding: 12px 20px;
        border: none;
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: 14px;
        font-weight: 700;
        color: #fff;
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }
    .start {
        background: var(--color-success-gradient);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
    }
    .start:hover {
        opacity: 0.9;
        transform: translateY(-1px);
    }
    .stop {
        background: var(--color-danger-gradient);
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
    }
    .stop:hover {
        opacity: 0.9;
        transform: translateY(-1px);
    }
    .add-step-btn {
        margin-top: 12px;
        width: 100%;
        text-align: center;
        background: rgba(244, 63, 94, 0.05);
        border: 1px dashed rgba(244, 63, 94, 0.2);
        color: var(--color-accent);
        padding: 10px;
        border-radius: var(--radius-md);
        font-size: 13px;
        font-weight: 600;
    }
    .add-step-btn:hover:not(:disabled) {
        background: rgba(244, 63, 94, 0.1);
        border-color: rgba(244, 63, 94, 0.3);
        transform: translateY(-1px);
    }

    /* Compact Workflow Selector Bar Styling */
    .workflow-selector-bar {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 0 16px;
        border-bottom: 1px solid var(--border-color);
        margin-bottom: 12px;
    }

    .custom-select-wf {
        background: var(--bg-card);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        font-size: 12px;
        font-weight: 600;
        padding: 6px 20px 6px 8px;
        outline: none;
        cursor: pointer;
        appearance: none;
        transition: border-color var(--transition-fast);
        max-width: 140px;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
    }

    .workflow-name-input {
        flex: 1;
        background: var(--bg-main);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 600;
        outline: none;
    }

    .workflow-name-input:focus {
        border-color: var(--color-accent);
    }

    .btn-wf-action {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        padding: 6px;
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all var(--transition-fast);
    }

    .btn-wf-action:hover:not(:disabled) {
        background: var(--bg-card-hover);
        border-color: var(--border-hover);
    }

    /* Nested tab controls inside right area */
    .right-tabs {
        display: flex;
        gap: 6px;
        margin-bottom: 16px;
        background: var(--bg-panel);
        padding: 4px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-color);
        align-self: flex-start;
    }

    .tab-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        padding: 6px 14px;
        font-size: 11px;
        font-weight: 600;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all var(--transition-fast);
    }

    .tab-btn:hover {
        color: var(--text-primary);
    }

    .tab-btn.active {
        background: var(--bg-card);
        color: var(--color-accent);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }

    .ocr-tab-container {
        flex: 1;
        min-height: 0;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        overflow: hidden;
    }

    /* COLLAPSIBLE DEVELOPER CONSOLE DRAWER */
    .screenshot-wrapper {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }

    .bottom-console {
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        overflow: hidden;
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        background: #060608;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35);
        transition: all var(--transition-normal);
        flex-shrink: 0;
    }

    .console-toggle-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        background: #09090b;
        cursor: pointer;
        user-select: none;
        font-size: 11px;
        font-family: var(--font-mono);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 700;
        color: var(--text-secondary);
        border-bottom: 1px solid var(--border-color);
    }

    .console-toggle-bar:hover {
        background: var(--bg-card-hover);
        color: var(--text-primary);
    }

    .console-badge {
        font-size: 9px;
        font-weight: 700;
        background: rgba(244, 63, 94, 0.1);
        border: 1px solid rgba(244, 63, 94, 0.2);
        color: var(--color-accent);
        padding: 1px 6px;
        border-radius: var(--radius-full);
    }

    .console-arrow {
        font-size: 10px;
        color: var(--text-muted);
    }

    .console-content {
        height: 220px;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }
</style>
