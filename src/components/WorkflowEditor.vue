<template>
    <div class="pane">
        <div class="editor-layout">
            <div class="editor-left">
                <div class="editor-left-top">
                    <WorkflowHeader
                        v-model:workflow-name="workflowName"
                        :saved-workflows="savedWorkflows"
                        :disabled="running"
                        @load="onLoadWorkflow"
                    />
                    <ModeSelector
                        v-model:use-scrcpy="useScrcpy"
                        v-model:adb-path="adbPath"
                        :device-resolution="deviceResolution"
                        :disabled="running"
                        @browse-adb="browseAdb"
                        @detect-resolution="detectResolution"
                    />
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
                            <button class="small" @click="saveWorkflow" :disabled="running">
                                Save
                            </button>
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
                            :use-scrcpy="useScrcpy"
                            :progress="workflowProgress"
                            :disabled="running"
                            @select="selectedStepIdx = i"
                            @remove="removeStep(i)"
                            @run-from="runFromHere(i)"
                            @duplicate="duplicateStep(i)"
                            @start-picking-coords="startPickingCoords(i)"
                            @start-picking-swipe="startPickingSwipe(i)"
                        />
                        <button class="small add-step-btn" @click="addStep" :disabled="running">
                            + Add Step
                        </button>
                    </div>
                </div>
            </div>

            <div class="editor-right">
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
                    @update:selected-handle="selectedHandle = $event"
                    @refresh-windows="refreshWindows"
                    @capture="captureScreenshot"
                    @toggle-ocr-blocks="toggleOcrBlocks"
                    @pick-ocr-block="pickOcrBlock"
                    @screenshot-click="onScreenshotClick"
                    @image-load="onImageLoad"
                    @image-hover="hoverCoord = $event"
                    @hover-clear="hoverCoord = null"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
    import WorkflowHeader from './WorkflowHeader.vue'
    import ModeSelector from './ModeSelector.vue'
    import StepCard from './StepCard.vue'
    import ScreenshotPanel from './ScreenshotPanel.vue'
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

    const emit = defineEmits<{ log: [level: string, msg: string] }>()

    const windows = ref<any[]>([])
    const selectedHandle = ref<number | null>(null)
    const screenshotSrc = ref('')
    const screenshotWindow = ref<any>(null)
    const captureWidth = ref(0)
    const captureHeight = ref(0)

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
    const runFromHereIdx = ref<number | null>(null)

    const ocrBlocks = ref<any[]>([])
    const showOcrBlocks = ref(false)
    const selectedOcrBlock = ref<number | null>(null)
    const workflowProgress = ref<WorkflowProgress | null>(null)
    const workflowGen = ref(0)

    const defaultWaitMs = ref(0.5)
    const useScrcpy = ref(false)
    const deviceResolution = ref({ width: 0, height: 0 })
    const adbPath = ref('adb')
    const editorScrollRef = ref<HTMLDivElement | null>(null)

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
            const res = await window.api.getDeviceResolution(adbPath.value)
            if (res.width && res.height) {
                deviceResolution.value = res
                emit('log', 'info', `Device resolution: ${res.width}x${res.height}`)
            } else {
                emit('log', 'error', 'Could not detect device resolution - is adb connected?')
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
        windows.value = await window.api.listWindows()
    }

    async function captureScreenshot() {
        if (!selectedHandle.value) {
            emit('log', 'warn', 'Select a window first')
            return
        }
        const result = await window.api.captureWindow(selectedHandle.value)
        screenshotWindow.value = result.window
        screenshotSrc.value = `data:image/png;base64,${result.image}`
        ocrBlocks.value = []
        showOcrBlocks.value = false
        selectedOcrBlock.value = null
    }

    async function toggleOcrBlocks() {
        showOcrBlocks.value = !showOcrBlocks.value
        if (showOcrBlocks.value && ocrBlocks.value.length === 0) {
            try {
                const b64 = screenshotSrc.value.replace('data:image/png;base64,', '')
                const result = await window.api.ocrImageWithLang(b64, 'en-US', 1)
                ocrBlocks.value = (result.blocks || []).map((b: any) => ({
                    text: b.text,
                    bbox: b.bbox,
                }))
                emit('log', 'info', `OCR found ${ocrBlocks.value.length} word blocks`)
            } catch (e: any) {
                emit('log', 'error', `OCR failed: ${e.message || e}`)
                showOcrBlocks.value = false
            }
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
            selectedStepIdx.value = null
            emit('log', 'info', `Loaded workflow "${wf.name}"`)
        }
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

        const si = runFromHereIdx.value !== null ? runFromHereIdx.value : 0
        runFromHereIdx.value = null

        const config = await window.api.loadConfig()
        config.targetWindowTitle = config.targetWindowTitle || (screenshotWindow.value?.title ?? '')
        config.useScrcpy = useScrcpy.value
        config.adbPath = adbPath.value
        config.deviceResolution = deviceResolution.value

        const dw = deviceResolution.value.width
        const dh = deviceResolution.value.height
        const scaleAdb =
            useScrcpy.value && dw > 0 && dh > 0 && captureWidth.value > 0 && captureHeight.value > 0

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
            `Workflow "${workflow.name}" started from step ${si + 1} (${stepCount} steps, ${useScrcpy.value ? 'scrcpy' : 'mouse'} mode)`,
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
                if (selectedHandle.value) {
                    window.api
                        .captureWindow(selectedHandle.value)
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
            if (selectedHandle.value) {
                window.api
                    .captureWindow(selectedHandle.value)
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

        const wins = await window.api.listWindows()
        windows.value = wins
        if (wins.length > 0) {
            selectedHandle.value = wins[0].id
        }

        const c = await window.api.loadConfig()
        useScrcpy.value = c.useScrcpy ?? false
        deviceResolution.value = c.deviceResolution || { width: 0, height: 0 }
        adbPath.value = c.adbPath || 'adb'
        savedWorkflows.value = c.workflows || []
        defaultWaitMs.value =
            c.defaultWaitMs > 60 ? Math.round(c.defaultWaitMs / 1000) : c.defaultWaitMs || 0.5
        if (savedWorkflows.value.length > 0) {
            const wf = savedWorkflows.value[0]
            workflowName.value = wf.name
            steps.value = JSON.parse(JSON.stringify(wf.steps))
        }
    })

    onUnmounted(() => {
        globalCleanup()
    })
</script>

<style scoped>
    .pane {
        height: 100%;
        display: flex;
        flex-direction: column;
    }
    .editor-layout {
        display: flex;
        flex: 1;
        overflow: hidden;
    }
    .editor-left {
        width: 50%;
        min-width: 380px;
        display: flex;
        flex-direction: column;
        border-right: 1px solid #0f3460;
        min-height: 0;
    }
    .editor-left-top {
        padding: 16px 16px 0;
        flex-shrink: 0;
    }
    .editor-left-scroll {
        padding: 0 16px 16px;
        overflow-y: auto;
        flex: 1;
        min-height: 0;
    }
    .editor-right {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
    }
    .section {
        margin-bottom: 16px;
    }
    .section label {
        display: block;
        font-size: 12px;
        color: #aaa;
        margin-bottom: 4px;
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
        padding: 3px 10px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
    }
    button.small:disabled {
        opacity: 0.5;
    }
    .no-items {
        font-size: 12px;
        color: #555;
        padding: 16px;
        text-align: center;
    }
    .actions-row {
        padding: 8px 0 12px;
    }
    .actions-row button {
        width: 100%;
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        color: #fff;
    }
    .start {
        background: #2e7d32;
    }
    .stop {
        background: #c62828;
    }
    .add-step-btn {
        margin-top: 8px;
        width: 100%;
        text-align: center;
    }
</style>
