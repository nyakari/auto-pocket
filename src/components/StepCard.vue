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
            @mouseenter="emit('hover', true)"
            @mouseleave="emit('hover', false)"
        >
            <div class="step-header">
                <div class="drag-handle" ref="dragHandleRef">
                    <span class="grip">⋮⋮</span>
                </div>
                <span class="step-num">{{ stepIndex + 1 }}</span>
                <div class="select-wrapper">
                    <select
                        v-model="step.type"
                        @change="onTypeChange"
                        :disabled="disabled"
                        class="custom-select-inline"
                    >
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
                </div>
                <input
                    v-model="step.name"
                    placeholder="Step name"
                    class="step-name"
                    :disabled="disabled"
                />
                <div class="action-buttons">
                    <button
                        class="btn-action run-from-btn"
                        @click.stop="emit('runFrom')"
                        :disabled="disabled"
                        title="Run from this step"
                    >
                        ▶
                    </button>
                    <button
                        class="btn-action dup-btn"
                        @click.stop="emit('duplicate')"
                        :disabled="disabled"
                        title="Duplicate step"
                    >
                        ❐
                    </button>
                    <button
                        class="btn-action delete-btn"
                        @click.stop="emit('remove')"
                        :disabled="disabled"
                        title="Delete step"
                    >
                        ✕
                    </button>
                </div>
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
                :saved-workflows="savedWorkflows"
                @start-picking-coords="emit('startPickingCoords')"
                @start-picking-swipe="emit('startPickingSwipe')"
            />
            <div v-else class="step-summary">
                <span class="step-summary-text">{{ summaryText }}</span>
                <div v-if="isCurrentStep" class="step-progress-inline">
                    <div class="progress-bar-inline" :class="{ indeterminate: isIndeterminate }">
                        <div
                            class="progress-fill-inline"
                            :style="
                                isIndeterminate
                                    ? {}
                                    : {
                                          width:
                                              (progress && progress.total > 0
                                                  ? (progress.elapsed / progress.total) * 100
                                                  : 0) + '%',
                                      }
                            "
                        ></div>
                    </div>
                    <span class="progress-label-inline">
                        <template v-if="isIndeterminate"> Wait Before... </template>
                        <template v-else-if="progress">
                            {{ Math.round(progress.elapsed / 1000) }}s /
                            {{ Math.round(progress.total / 1000) }}s
                        </template>
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
        savedWorkflows: any[]
    }>()

    const emit = defineEmits<{
        select: []
        remove: []
        runFrom: []
        duplicate: []
        startPickingCoords: []
        startPickingSwipe: []
        hover: [isHovered: boolean]
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

    const isIndeterminate = computed(() => {
        return !props.progress || props.progress.type === 'waitBefore'
    })

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
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        margin-bottom: 8px;
        cursor: pointer;
        transition: all var(--transition-fast);
        overflow: hidden;
    }

    .step-card:hover {
        border-color: var(--border-hover);
        background: var(--bg-card-hover);
    }

    .step-card.active {
        border-color: var(--color-accent);
        box-shadow: 0 4px 16px rgba(244, 63, 94, 0.12);
    }

    .step-card.running {
        border-color: var(--color-warning);
        box-shadow: 0 4px 16px rgba(245, 158, 11, 0.15);
        animation: borderPulse 1.8s infinite;
    }

    .step-card.done {
        border-color: var(--color-success);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.08);
    }

    .step-card.is-dragging {
        opacity: 0.4;
    }

    .step-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
    }

    .drag-handle {
        cursor: grab;
        padding: 4px;
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
        color: var(--text-muted);
        font-size: 14px;
        line-height: 1;
        letter-spacing: -1.5px;
        transition: color var(--transition-fast);
    }

    .drag-handle:hover .grip {
        color: var(--text-secondary);
    }

    .step-num {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: var(--bg-main);
        color: var(--color-accent);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 800;
        border: 1px solid rgba(244, 63, 94, 0.2);
    }

    .select-wrapper {
        position: relative;
    }

    .custom-select-inline {
        background: var(--bg-main);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        font-size: 12px;
        font-weight: 600;
        padding: 4px 20px 4px 8px;
        outline: none;
        cursor: pointer;
        appearance: none;
        transition: border-color var(--transition-fast);
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

    .custom-select-inline:disabled {
        opacity: 0.5;
    }

    .step-name {
        flex: 1;
        font-size: 13px;
        font-weight: 550;
        padding: 4px 8px;
        background: transparent;
        color: var(--text-primary);
        border: 1px solid transparent;
        border-radius: var(--radius-sm);
        outline: none;
        transition: all var(--transition-fast);
    }

    .step-name:focus {
        background: var(--bg-main);
        border-color: var(--border-color);
    }

    .step-name:disabled {
        opacity: 0.5;
    }

    .action-buttons {
        display: flex;
        gap: 4px;
        align-items: center;
    }

    .btn-action {
        background: transparent;
        border: 1px solid transparent;
        cursor: pointer;
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        font-size: 12px;
        color: var(--text-muted);
        transition: all var(--transition-fast);
    }

    .btn-action:hover:not(:disabled) {
        background: var(--bg-main);
        border-color: var(--border-color);
        color: var(--text-primary);
    }

    .btn-action:disabled {
        opacity: 0.4;
    }

    .run-from-btn {
        color: var(--color-success);
    }
    .run-from-btn:hover:not(:disabled) {
        background: rgba(16, 185, 129, 0.1) !important;
        border-color: rgba(16, 185, 129, 0.2) !important;
        color: var(--color-success) !important;
    }

    .delete-btn {
        color: var(--color-danger);
    }
    .delete-btn:hover:not(:disabled) {
        background: rgba(239, 68, 68, 0.1) !important;
        border-color: rgba(239, 68, 68, 0.2) !important;
        color: var(--color-danger) !important;
    }

    .step-summary {
        padding: 0 14px 12px 42px;
        font-size: 12px;
        color: var(--text-secondary);
        font-weight: 500;
    }

    .step-summary-text {
        display: block;
        line-height: 1.4;
    }

    .step-progress-inline {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 6px;
    }

    .progress-bar-inline {
        flex: 1;
        max-width: 160px;
        height: 6px;
        background: var(--bg-main);
        border-radius: var(--radius-full);
        overflow: hidden;
        border: 1px solid var(--border-color);
        position: relative;
    }

    .progress-fill-inline {
        height: 100%;
        background: var(--color-warning);
        border-radius: var(--radius-full);
        transition: width 0.25s linear;
    }

    .progress-bar-inline.indeterminate .progress-fill-inline {
        width: 50% !important;
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        background: linear-gradient(90deg, transparent, var(--color-warning), transparent);
        animation: progress-indeterminate 1.5s infinite linear;
        transition: none;
    }

    @keyframes progress-indeterminate {
        0% {
            transform: translateX(-100%);
        }
        100% {
            transform: translateX(200%);
        }
    }

    .progress-label-inline {
        font-size: 10px;
        font-weight: 600;
        color: var(--text-muted);
        white-space: nowrap;
    }

    .drop-indicator {
        position: absolute;
        left: 0;
        right: 0;
        height: 4px;
        background: var(--color-accent);
        border-radius: var(--radius-full);
        pointer-events: none;
        z-index: 10;
        box-shadow: 0 0 8px var(--color-accent);
    }

    .drop-indicator.top {
        top: -4px;
    }

    .drop-indicator.bottom {
        bottom: 4px;
    }

    .drag-preview {
        background: var(--bg-card);
        border: 2px solid var(--color-accent);
        border-radius: var(--radius-md);
        padding: 10px 16px;
        color: var(--text-primary);
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }

    @keyframes borderPulse {
        0%,
        100% {
            border-color: var(--color-warning);
        }
        50% {
            border-color: #fbbf24;
        }
    }
</style>
