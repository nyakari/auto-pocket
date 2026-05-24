<template>
    <div class="step-detail">
        <div class="detail-grid">
            <div class="field">
                <label>Wait Before (s)</label>
                <input
                    v-model.number="step.waitBeforeMs"
                    type="number"
                    min="0"
                    step="0.5"
                    class="custom-input"
                />
            </div>

            <template v-if="step.type === 'clickXY'">
                <div class="field">
                    <label>Target X</label>
                    <input v-model.number="step.x" type="number" class="custom-input" />
                </div>
                <div class="field">
                    <label>Target Y</label>
                    <input v-model.number="step.y" type="number" class="custom-input" />
                </div>
                <div class="field-full">
                    <button
                        class="btn-pick"
                        @click="emit('startPickingCoords')"
                        :class="{ active: isPickingCoords }"
                    >
                        {{ isPickingCoords ? '🎯 Click on screenshot' : '📍 Pick from screenshot' }}
                    </button>
                </div>
            </template>

            <template v-if="step.type === 'clickText' || step.type === 'waitText'">
                <div class="field-full">
                    <label
                        >Text to
                        {{ step.type === 'clickText' ? 'Find & Click' : 'Wait For' }}</label
                    >
                    <input
                        v-model="(step as any).when"
                        placeholder="e.g. Battle"
                        class="custom-input"
                    />
                </div>
                <div class="field">
                    <label>Timeout (s)</label>
                    <input
                        v-model.number="(step as any).timeoutMs"
                        type="number"
                        min="1"
                        step="1"
                        class="custom-input"
                    />
                </div>
                <template v-if="step.type === 'clickText'">
                    <div class="field">
                        <label>Which Match</label>
                        <div class="select-wrapper">
                            <select v-model="(step as any).matchMode" class="custom-select">
                                <option value="first">First Match</option>
                                <option value="last">Last Match</option>
                                <option value="nth">N-th Match</option>
                            </select>
                        </div>
                    </div>
                    <div class="field" v-if="(step as any).matchMode === 'nth'">
                        <label>Match Number (N)</label>
                        <input
                            v-model.number="(step as any).matchN"
                            type="number"
                            step="1"
                            class="custom-input"
                        />
                        <span class="field-hint">1 = 1st, 2 = 2nd, -1 = last</span>
                    </div>
                    <div class="field-full">
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="(step as any).wholeWord" />
                            <span>Match whole word only</span>
                        </label>
                    </div>
                </template>
            </template>

            <template v-if="step.type === 'wait'">
                <div class="field">
                    <label>Duration (s)</label>
                    <input
                        v-model.number="(step as any).durationMs"
                        type="number"
                        min="0.1"
                        step="0.5"
                        class="custom-input"
                    />
                </div>
            </template>

            <template v-if="step.type === 'goto'">
                <div class="field-full">
                    <label>Target Step</label>
                    <StepSelector
                        v-model="(step as any).targetStepId"
                        :steps="allSteps"
                        :current-step-index="stepIndex"
                        :disabled="disabled"
                    />
                </div>
            </template>

            <template v-if="step.type === 'condition'">
                <div class="field-full">
                    <label>Text to Find</label>
                    <input
                        v-model="(step as any).when"
                        placeholder="e.g. Battle"
                        class="custom-input"
                    />
                </div>
                <div class="field-full">
                    <label>If found, go to step</label>
                    <StepSelector
                        v-model="(step as any).thenStepId"
                        :steps="allSteps"
                        :current-step-index="stepIndex"
                        :disabled="disabled"
                    />
                </div>
                <div class="field-full">
                    <label>If NOT found</label>
                    <StepSelector
                        v-model="(step as any).elseStepId"
                        :steps="allSteps"
                        :current-step-index="stepIndex"
                        :include-continue="true"
                        :disabled="disabled"
                    />
                </div>
                <div class="field">
                    <label>Timeout (s)</label>
                    <input
                        v-model.number="(step as any).timeoutMs"
                        type="number"
                        min="1"
                        step="1"
                        class="custom-input"
                    />
                </div>
                <div class="field-full">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="(step as any).wholeWord" />
                        <span>Match whole word only</span>
                    </label>
                </div>
            </template>

            <template v-if="step.type === 'setVar'">
                <div class="field">
                    <label>Variable Name</label>
                    <input
                        v-model="(step as any).varName"
                        placeholder="e.g. victory"
                        class="custom-input"
                    />
                </div>
                <div class="field">
                    <label>Value</label>
                    <input
                        v-model="(step as any).varValue"
                        placeholder="e.g. true"
                        class="custom-input"
                    />
                </div>
                <div class="field-full">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="(step as any).persist" />
                        <span>Persist across workflow runs</span>
                    </label>
                </div>
            </template>

            <template v-if="step.type === 'checkVar'">
                <div class="field">
                    <label>Variable Name</label>
                    <input
                        v-model="(step as any).varName"
                        placeholder="e.g. victory"
                        class="custom-input"
                    />
                </div>
                <div class="field">
                    <label>Expected Value</label>
                    <input
                        v-model="(step as any).varValue"
                        placeholder="e.g. true"
                        class="custom-input"
                    />
                </div>
                <div class="field-full">
                    <label>If match, go to step</label>
                    <StepSelector
                        v-model="(step as any).thenStepId"
                        :steps="allSteps"
                        :current-step-index="stepIndex"
                        :disabled="disabled"
                    />
                </div>
                <div class="field-full">
                    <label>If no match</label>
                    <StepSelector
                        v-model="(step as any).elseStepId"
                        :steps="allSteps"
                        :current-step-index="stepIndex"
                        :include-continue="true"
                        :disabled="disabled"
                    />
                </div>
            </template>

            <template v-if="step.type === 'swipe'">
                <div class="field">
                    <label>Start X</label>
                    <input v-model.number="(step as any).x1" type="number" class="custom-input" />
                </div>
                <div class="field">
                    <label>Start Y</label>
                    <input v-model.number="(step as any).y1" type="number" class="custom-input" />
                </div>
                <div class="field">
                    <label>End X</label>
                    <input v-model.number="(step as any).x2" type="number" class="custom-input" />
                </div>
                <div class="field">
                    <label>End Y</label>
                    <input v-model.number="(step as any).y2" type="number" class="custom-input" />
                </div>
                <div class="field">
                    <label>Duration (s)</label>
                    <input
                        v-model.number="(step as any).duration"
                        type="number"
                        min="0.1"
                        step="0.1"
                        class="custom-input"
                    />
                </div>
                <div class="field-full">
                    <button
                        class="btn-pick"
                        @click="emit('startPickingSwipe')"
                        :class="{ active: isPickingSwipe }"
                    >
                        {{
                            isPickingSwipe
                                ? '🎯 Click start, then end point'
                                : '📍 Pick from screenshot'
                        }}
                    </button>
                </div>
            </template>

            <template v-if="step.type === 'countText'">
                <div class="field-full">
                    <label>Text to Count</label>
                    <input
                        v-model="(step as any).when"
                        placeholder="e.g. Deck"
                        class="custom-input"
                    />
                </div>
                <div class="field">
                    <label>Variable Name</label>
                    <input
                        v-model="(step as any).varName"
                        placeholder="e.g. deck_count"
                        class="custom-input"
                    />
                </div>
                <div class="field">
                    <label>Timeout (s)</label>
                    <input
                        v-model.number="(step as any).timeoutMs"
                        type="number"
                        min="1"
                        step="1"
                        class="custom-input"
                    />
                </div>
            </template>

            <template v-if="step.type === 'captureLine'">
                <div class="field-full">
                    <label>Text to Find</label>
                    <input
                        v-model="(step as any).when"
                        placeholder="e.g. Deck"
                        class="custom-input"
                    />
                </div>
                <div class="field">
                    <label>Which Match</label>
                    <div class="select-wrapper">
                        <select v-model="(step as any).matchMode" class="custom-select">
                            <option value="first">First</option>
                            <option value="last">Last</option>
                            <option value="nth">Nth</option>
                        </select>
                    </div>
                </div>
                <div class="field" v-if="(step as any).matchMode === 'nth'">
                    <label>Match Number (N)</label>
                    <input
                        v-model.number="(step as any).matchN"
                        type="number"
                        step="1"
                        class="custom-input"
                    />
                    <span class="field-hint">1 = first, -1 = last</span>
                </div>
                <div class="field">
                    <label>Variable Name</label>
                    <input
                        v-model="(step as any).varName"
                        placeholder="e.g. last_line"
                        class="custom-input"
                    />
                </div>
                <div class="field">
                    <label>Timeout (s)</label>
                    <input
                        v-model.number="(step as any).timeoutMs"
                        type="number"
                        min="1"
                        step="1"
                        class="custom-input"
                    />
                </div>
                <div class="field-full">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="(step as any).wholeWord" />
                        <span>Match whole word only</span>
                    </label>
                </div>
            </template>

            <template v-if="step.type === 'callWorkflow'">
                <div class="field-full">
                    <label>Target Sub-Workflow</label>
                    <div class="select-wrapper">
                        <select
                            v-model="(step as any).targetWorkflow"
                            :disabled="disabled"
                            class="custom-select"
                        >
                            <option value="" disabled>-- Select Workflow --</option>
                            <option v-for="wf in savedWorkflows" :key="wf.name" :value="wf.name">
                                {{ wf.name }}
                            </option>
                        </select>
                    </div>
                    <span class="field-hint"
                        >Runs the selected workflow as a subroutine and resumes.</span
                    >
                </div>
            </template>
        </div>
        <div v-if="showProgress" class="step-progress">
            <div class="progress-bar" :class="{ indeterminate: isIndeterminate }">
                <div
                    class="progress-fill"
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
            <span class="progress-label">
                <template v-if="isIndeterminate"> Wait Before... </template>
                <template v-else-if="progress">
                    {{ progress.type === 'timeout' ? 'Timeout' : 'Wait' }}:
                    {{ Math.round(progress.elapsed / 1000) }}s /
                    {{ Math.round(progress.total / 1000) }}s
                </template>
            </span>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { watch, computed } from 'vue'
    import StepSelector from './StepSelector.vue'
    import type { Step, WorkflowProgress } from '../lib/workflow'

    const props = defineProps<{
        step: Step
        allSteps: Step[]
        stepIndex: number
        isPickingCoords?: boolean
        isPickingSwipe?: boolean
        showProgress?: boolean
        progress?: WorkflowProgress | null
        disabled?: boolean
        savedWorkflows: any[]
    }>()

    const emit = defineEmits<{
        startPickingCoords: []
        startPickingSwipe: []
    }>()

    const isIndeterminate = computed(() => {
        return !props.progress || props.progress.type === 'waitBefore'
    })

    watch(
        () => props.allSteps,
        () => {
            migrateLegacyIndexes(props.step, props.allSteps)
        },
        { immediate: true },
    )

    function migrateLegacyIndexes(step: Step, allSteps: Step[]) {
        if (step.type === 'goto') {
            if (!step.targetStepId && step.targetStep !== undefined && step.targetStep > 0) {
                const idx = step.targetStep - 1
                if (idx >= 0 && idx < allSteps.length) {
                    ;(step as any).targetStepId = allSteps[idx].id
                }
            }
        }
        if (step.type === 'condition' || step.type === 'checkVar') {
            if (!step.thenStepId && step.thenStep !== undefined && step.thenStep > 0) {
                const idx = step.thenStep - 1
                if (idx >= 0 && idx < allSteps.length) {
                    ;(step as any).thenStepId = allSteps[idx].id
                }
            }
            if (step.elseStepId === undefined && step.elseStep !== undefined) {
                if (step.elseStep === 0) {
                    ;(step as any).elseStepId = ''
                } else if (step.elseStep > 0) {
                    const idx = step.elseStep - 1
                    if (idx >= 0 && idx < allSteps.length) {
                        ;(step as any).elseStepId = allSteps[idx].id
                    }
                }
            }
        }
    }
</script>

<style scoped>
    .step-detail {
        padding: 16px 20px 20px;
        border-top: 1px solid var(--border-color);
        background: rgba(0, 0, 0, 0.15);
    }

    .step-progress {
        margin-top: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .progress-bar {
        flex: 1;
        height: 8px;
        background: var(--bg-main);
        border-radius: var(--radius-full);
        overflow: hidden;
        border: 1px solid var(--border-color);
        position: relative;
    }

    .progress-fill {
        height: 100%;
        background: var(--color-warning);
        border-radius: var(--radius-full);
        transition: width 0.25s linear;
    }

    .progress-bar.indeterminate .progress-fill {
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

    .progress-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-muted);
        white-space: nowrap;
    }

    .detail-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .field-full {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    label {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-secondary);
        letter-spacing: 0.1px;
    }

    .custom-input {
        background: var(--bg-main);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 8px 12px;
        font-size: 13px;
        outline: none;
        transition:
            border-color var(--transition-fast),
            box-shadow var(--transition-fast);
        width: 100%;
    }

    .custom-input:focus {
        border-color: var(--color-accent);
        box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.15);
    }

    .select-wrapper {
        position: relative;
    }

    .custom-select {
        width: 100%;
        background: var(--bg-main);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 8px 12px;
        font-size: 13px;
        outline: none;
        appearance: none;
        cursor: pointer;
        transition: border-color var(--transition-fast);
    }

    .custom-select:focus {
        border-color: var(--color-accent);
    }

    .select-wrapper::after {
        content: '▼';
        font-size: 8px;
        color: var(--text-muted);
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
    }

    .field-hint {
        font-size: 10px;
        color: var(--text-muted);
        margin-top: 2px;
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        font-weight: 550;
        color: var(--text-secondary);
        cursor: pointer;
        margin-top: 4px;
        user-select: none;
    }

    .checkbox-label input[type='checkbox'] {
        margin: 0;
        width: 14px;
        height: 14px;
        accent-color: var(--color-accent);
    }

    .btn-pick {
        background: var(--bg-main);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        padding: 8px 14px;
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all var(--transition-fast);
        margin-top: 4px;
    }

    .btn-pick:hover {
        background: var(--bg-card-hover);
        border-color: var(--border-hover);
    }

    .btn-pick.active {
        background: rgba(244, 63, 94, 0.1);
        border-color: var(--color-accent);
        color: var(--color-accent);
        box-shadow: 0 0 10px rgba(244, 63, 94, 0.1);
        animation: pulseBtn 1.8s infinite;
    }

    @keyframes pulseBtn {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.8;
        }
    }
</style>
