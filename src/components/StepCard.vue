<template>
    <div class="relative">
        <div
            ref="elRef"
            :data-step-id="step.id"
            class="step-card"
            :class="[
                {
                    active: isSelected,
                    running: isCurrentStep,
                    done: isDoneStep,
                    'is-dragging': elState.type === 'is-dragging',
                },
            ]"
            @click="emit('select')"
        >
            <div class="step-header">
                <div class="drag-handle" ref="dragHandleRef">
                    <span class="grip">⋮⋮</span>
                </div>
                <span class="step-num">{{ stepIndex + 1 }}</span>
                <select v-model="step.type" @change="onTypeChange" :disabled="disabled">
                    <option value="clickXY">Click XY</option>
                    <option value="clickText">Click Text</option>
                    <option value="waitText">Wait for Text</option>
                    <option value="wait">Wait (Delay)</option>
                    <option value="goto">Go to Step</option>
                    <option value="condition">Condition</option>
                    <option value="setVar">Set Variable</option>
                    <option value="checkVar">Check Variable</option>
                    <option value="swipe">Swipe / Drag</option>
                    <option value="countText">Count Text</option>
                    <option value="captureLine">Capture Line</option>
                </select>
                <input
                    v-model="step.name"
                    placeholder="Step name"
                    class="step-name"
                    :disabled="disabled"
                />
                <button
                    class="small run-from-btn"
                    @click.stop="emit('runFrom')"
                    :disabled="disabled"
                    title="Run from this step"
                >
                    &#9654;
                </button>
                <button
                    class="small"
                    @click.stop="emit('duplicate')"
                    :disabled="disabled"
                    title="Duplicate step"
                >
                    &#x29C9;
                </button>
                <button class="small danger" @click.stop="emit('remove')" :disabled="disabled">
                    &#10005;
                </button>
            </div>
            <StepDetail
                v-if="isSelected"
                :step="step"
                :all-steps="allSteps"
                :step-index="stepIndex"
                :is-picking-coords="isPickingCoords"
                :is-picking-swipe="isPickingSwipe"
                :show-progress="isCurrentStep"
                :progress="progress"
                :disabled="disabled"
                @start-picking-coords="emit('startPickingCoords')"
                @start-picking-swipe="emit('startPickingSwipe')"
            />
            <div v-else class="step-summary">
                <span class="step-summary-text">{{ summaryText }}</span>
                <div v-if="isCurrentStep && progress" class="step-progress-inline">
                    <div class="progress-bar-inline">
                        <div
                            class="progress-fill-inline"
                            :style="{
                                width:
                                    (progress.total > 0
                                        ? (progress.elapsed / progress.total) * 100
                                        : 0) + '%',
                            }"
                        ></div>
                    </div>
                    <span class="progress-label-inline">
                        {{ Math.round(progress.elapsed / 1000) }}s /
                        {{ Math.round(progress.total / 1000) }}s
                    </span>
                </div>
            </div>
        </div>
        <div
            v-if="elState.type === 'is-dragging-over' && elState.closestEdge"
            class="drop-indicator"
            :class="elState.closestEdge"
        ></div>
        <Teleport v-if="elState.type === 'preview'" :to="elState.container">
            <div class="drag-preview">
                {{ previewLabel }}
            </div>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
    import { ref, computed, onMounted, onUnmounted } from 'vue'
    import StepDetail from './StepDetail.vue'
    import {
        stepSummary,
        resetStepFields,
        setStepDefaults,
        type Step,
        type WorkflowProgress,
    } from '../lib/workflow'
    import {
        draggable,
        dropTargetForElements,
    } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
    import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
    import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview'
    import { pointerOutsideOfPreview } from '@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview'
    import {
        attachClosestEdge,
        type Edge,
        extractClosestEdge,
    } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'

    const props = defineProps<{
        step: Step
        stepIndex: number
        allSteps: Step[]
        isSelected?: boolean
        isCurrentStep?: boolean
        isDoneStep?: boolean
        isPickingCoords?: boolean
        isPickingSwipe?: boolean
        useScrcpy?: boolean
        progress?: WorkflowProgress | null
        disabled?: boolean
    }>()

    const emit = defineEmits<{
        select: []
        remove: []
        runFrom: []
        duplicate: []
        startPickingCoords: []
        startPickingSwipe: []
    }>()

    const elRef = ref<HTMLDivElement | null>(null)
    const dragHandleRef = ref<HTMLDivElement | null>(null)

    type CardState =
        | { type: 'idle' }
        | { type: 'preview'; container: HTMLElement }
        | { type: 'is-dragging' }
        | { type: 'is-dragging-over'; closestEdge: Edge | null }

    const idle: CardState = { type: 'idle' }
    const elState = ref<CardState>(idle)

    const summaryText = computed(() =>
        stepSummary(props.step, props.allSteps, props.useScrcpy ?? false),
    )

    const previewLabel = computed(() => {
        if (props.step.name && props.step.name.trim()) {
            return `Step ${props.stepIndex + 1}: ${props.step.name.trim()}`
        }
        return `Step ${props.stepIndex + 1}`
    })

    function onTypeChange() {
        resetStepFields(props.step)
        setStepDefaults(props.step, props.allSteps)
    }

    let cleanup = () => {}

    onMounted(() => {
        if (!elRef.value || !dragHandleRef.value) return

        cleanup = combine(
            draggable({
                element: elRef.value,
                dragHandle: dragHandleRef.value,
                getInitialData() {
                    return { stepId: props.step.id }
                },
                onGenerateDragPreview({ nativeSetDragImage }) {
                    setCustomNativeDragPreview({
                        nativeSetDragImage,
                        getOffset: pointerOutsideOfPreview({
                            x: '16px',
                            y: '8px',
                        }),
                        render({ container }) {
                            elState.value = { type: 'preview', container }
                        },
                    })
                },
                onDragStart() {
                    elState.value = { type: 'is-dragging' }
                },
                onDrop() {
                    elState.value = idle
                },
            }),
            dropTargetForElements({
                element: elRef.value,
                canDrop({ source }) {
                    if (source.element === elRef.value) return false
                    return typeof (source.data as any).stepId === 'string'
                },
                getData({ input }) {
                    return attachClosestEdge(
                        { stepId: props.step.id },
                        {
                            element: elRef.value!,
                            input,
                            allowedEdges: ['top', 'bottom'],
                        },
                    )
                },
                getIsSticky() {
                    return true
                },
                onDragEnter({ self }) {
                    const closestEdge = extractClosestEdge(self.data)
                    elState.value = { type: 'is-dragging-over', closestEdge }
                },
                onDrag({ self }) {
                    const closestEdge = extractClosestEdge(self.data)
                    if (
                        elState.value.type !== 'is-dragging-over' ||
                        elState.value.closestEdge !== closestEdge
                    ) {
                        elState.value = { type: 'is-dragging-over', closestEdge }
                    }
                },
                onDragLeave() {
                    elState.value = idle
                },
                onDrop() {
                    elState.value = idle
                },
            }),
        )
    })

    onUnmounted(() => {
        cleanup()
    })
</script>

<style scoped>
    .relative {
        position: relative;
    }
    .step-card {
        background: #16213e;
        border: 1px solid #0f3460;
        border-radius: 4px;
        margin-bottom: 6px;
        cursor: pointer;
        transition: opacity 0.15s ease;
    }
    .step-card.active {
        border-color: #e94560;
    }
    .step-card.running {
        border-color: #ffa726;
    }
    .step-card.done {
        border-color: #2e7d32;
    }
    .step-card.is-dragging {
        opacity: 0.4;
    }
    .step-header {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 8px;
    }
    .drag-handle {
        cursor: grab;
        padding: 0 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        -webkit-user-select: none;
    }
    .drag-handle:active {
        cursor: grabbing;
    }
    .grip {
        color: #666;
        font-size: 12px;
        line-height: 1;
        letter-spacing: -1px;
    }
    .drag-handle:hover .grip {
        color: #aaa;
    }
    .step-num {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #0f3460;
        color: #e94560;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: bold;
    }
    .step-header select {
        flex: 0 0 110px;
        font-size: 11px;
        padding: 2px 4px;
        background: #0f3460;
        color: #e0e0e0;
        border: 1px solid #1a1a4e;
        border-radius: 3px;
    }
    .step-header select:disabled {
        opacity: 0.5;
    }
    .step-name {
        flex: 1;
        font-size: 12px;
        padding: 2px 6px;
        background: transparent;
        color: #e0e0e0;
        border: 1px solid transparent;
        border-radius: 3px;
    }
    .step-name:focus {
        border-color: #0f3460;
    }
    .step-name:disabled {
        opacity: 0.5;
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
    button.danger {
        color: #ef5350;
    }
    .run-from-btn {
        color: #66bb6a !important;
        font-size: 13px !important;
        padding: 2px 6px !important;
    }
    .step-summary {
        padding: 4px 8px 8px 36px;
        font-size: 11px;
        color: #888;
    }
    .step-summary-text {
        display: block;
        margin-bottom: 4px;
    }
    .step-progress-inline {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .progress-bar-inline {
        flex: 1;
        max-width: 200px;
        height: 6px;
        background: #0f3460;
        border-radius: 3px;
        overflow: hidden;
    }
    .progress-fill-inline {
        height: 100%;
        background: #ffa726;
        border-radius: 3px;
        transition: width 0.25s linear;
    }
    .progress-label-inline {
        font-size: 10px;
        color: #888;
        white-space: nowrap;
    }
    .drop-indicator {
        position: absolute;
        left: 0;
        right: 0;
        height: 3px;
        background: #e94560;
        border-radius: 2px;
        pointer-events: none;
        z-index: 10;
    }
    .drop-indicator.top {
        top: -2px;
    }
    .drop-indicator.bottom {
        bottom: 4px;
    }
    .drag-preview {
        background: #16213e;
        border: 1px solid #e94560;
        border-radius: 4px;
        padding: 8px 12px;
        color: #e0e0e0;
        font-size: 13px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }
</style>
