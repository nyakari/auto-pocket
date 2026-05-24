<template>
    <div class="step-detail">
        <div class="detail-grid">
            <div class="field">
                <label>Wait before (s)</label>
                <input v-model.number="step.waitBeforeMs" type="number" min="0" step="0.5" />
            </div>

            <template v-if="step.type === 'clickXY'">
                <div class="field">
                    <label>X</label>
                    <input v-model.number="step.x" type="number" />
                </div>
                <div class="field">
                    <label>Y</label>
                    <input v-model.number="step.y" type="number" />
                </div>
                <div class="field-full">
                    <button
                        class="small"
                        @click="emit('startPickingCoords')"
                        :class="{ active: isPickingCoords }"
                    >
                        {{
                            isPickingCoords ? 'Click on screenshot to set' : 'Pick from screenshot'
                        }}
                    </button>
                </div>
            </template>

            <template v-if="step.type === 'clickText' || step.type === 'waitText'">
                <div class="field-full">
                    <label
                        >Text to
                        {{ step.type === 'clickText' ? 'find & click' : 'wait for' }}</label
                    >
                    <input v-model="(step as any).when" placeholder="e.g. Battle" />
                </div>
                <div class="field">
                    <label>Timeout (s)</label>
                    <input
                        v-model.number="(step as any).timeoutMs"
                        type="number"
                        min="1"
                        step="1"
                    />
                </div>
                <template v-if="step.type === 'clickText'">
                    <div class="field">
                        <label>Which match</label>
                        <select v-model="(step as any).matchMode">
                            <option value="first">First</option>
                            <option value="last">Last</option>
                            <option value="nth">Nth</option>
                        </select>
                    </div>
                    <div class="field" v-if="(step as any).matchMode === 'nth'">
                        <label>Match number</label>
                        <input v-model.number="(step as any).matchN" type="number" step="1" />
                        <span class="field-hint"
                            >1 = first, 2 = second, -1 = last, -2 = 2nd last</span
                        >
                    </div>
                    <div class="field-full">
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="(step as any).wholeWord" />
                            Match whole word only
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
                    <label>Text to find</label>
                    <input v-model="(step as any).when" placeholder="e.g. Battle" />
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
                    />
                </div>
                <div class="field-full">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="(step as any).wholeWord" />
                        Match whole word only
                    </label>
                </div>
            </template>

            <template v-if="step.type === 'setVar'">
                <div class="field">
                    <label>Variable name</label>
                    <input v-model="(step as any).varName" placeholder="e.g. victory" />
                </div>
                <div class="field">
                    <label>Value</label>
                    <input v-model="(step as any).varValue" placeholder="e.g. true" />
                </div>
                <div class="field-full">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="(step as any).persist" />
                        Persist across workflow runs
                    </label>
                </div>
            </template>

            <template v-if="step.type === 'checkVar'">
                <div class="field">
                    <label>Variable name</label>
                    <input v-model="(step as any).varName" placeholder="e.g. victory" />
                </div>
                <div class="field">
                    <label>Expected value</label>
                    <input v-model="(step as any).varValue" placeholder="e.g. true" />
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
                    <input v-model.number="(step as any).x1" type="number" />
                </div>
                <div class="field">
                    <label>Start Y</label>
                    <input v-model.number="(step as any).y1" type="number" />
                </div>
                <div class="field">
                    <label>End X</label>
                    <input v-model.number="(step as any).x2" type="number" />
                </div>
                <div class="field">
                    <label>End Y</label>
                    <input v-model.number="(step as any).y2" type="number" />
                </div>
                <div class="field">
                    <label>Duration (s)</label>
                    <input
                        v-model.number="(step as any).duration"
                        type="number"
                        min="0.1"
                        step="0.1"
                    />
                </div>
                <div class="field-full">
                    <button
                        class="small"
                        @click="emit('startPickingSwipe')"
                        :class="{ active: isPickingSwipe }"
                    >
                        {{
                            isPickingSwipe ? 'Click start, then end point' : 'Pick from screenshot'
                        }}
                    </button>
                </div>
            </template>

            <template v-if="step.type === 'countText'">
                <div class="field-full">
                    <label>Text to count</label>
                    <input v-model="(step as any).when" placeholder="e.g. Deck" />
                </div>
                <div class="field">
                    <label>Variable name</label>
                    <input v-model="(step as any).varName" placeholder="e.g. deck_count" />
                </div>
                <div class="field">
                    <label>Timeout (s)</label>
                    <input
                        v-model.number="(step as any).timeoutMs"
                        type="number"
                        min="1"
                        step="1"
                    />
                </div>
            </template>

            <template v-if="step.type === 'captureLine'">
                <div class="field-full">
                    <label>Text to find</label>
                    <input v-model="(step as any).when" placeholder="e.g. Deck" />
                </div>
                <div class="field">
                    <label>Which match</label>
                    <select v-model="(step as any).matchMode">
                        <option value="first">First</option>
                        <option value="last">Last</option>
                        <option value="nth">Nth</option>
                    </select>
                </div>
                <div class="field" v-if="(step as any).matchMode === 'nth'">
                    <label>Match number</label>
                    <input v-model.number="(step as any).matchN" type="number" step="1" />
                    <span class="field-hint">1 = first, 2 = second, -1 = last, -2 = 2nd last</span>
                </div>
                <div class="field">
                    <label>Variable name</label>
                    <input v-model="(step as any).varName" placeholder="e.g. last_line" />
                </div>
                <div class="field">
                    <label>Timeout (s)</label>
                    <input
                        v-model.number="(step as any).timeoutMs"
                        type="number"
                        min="1"
                        step="1"
                    />
                </div>
                <div class="field-full">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="(step as any).wholeWord" />
                        Match whole word only
                    </label>
                </div>
            </template>
        </div>
        <div v-if="showProgress && progress" class="step-progress">
            <div class="progress-bar">
                <div
                    class="progress-fill"
                    :style="{
                        width:
                            (progress.total > 0 ? (progress.elapsed / progress.total) * 100 : 0) +
                            '%',
                    }"
                ></div>
            </div>
            <span class="progress-label">
                {{ progress.type === 'timeout' ? 'Timeout' : 'Wait' }}:
                {{ Math.round(progress.elapsed / 1000) }}s /
                {{ Math.round(progress.total / 1000) }}s
            </span>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { watch } from 'vue'
    import StepSelector from './StepSelector.vue'
    import type { Step, WorkflowProgress } from '../lib/workflow'
    import { resolveStepIndex } from '../lib/workflow'

    const props = defineProps<{
        step: Step
        allSteps: Step[]
        stepIndex: number
        isPickingCoords?: boolean
        isPickingSwipe?: boolean
        showProgress?: boolean
        progress?: WorkflowProgress | null
        disabled?: boolean
    }>()

    const emit = defineEmits<{
        startPickingCoords: []
        startPickingSwipe: []
    }>()

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
        padding: 8px;
        border-top: 1px solid #0f3460;
    }
    .step-progress {
        margin-top: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .progress-bar {
        flex: 1;
        height: 8px;
        background: #0f3460;
        border-radius: 4px;
        overflow: hidden;
    }
    .progress-fill {
        height: 100%;
        background: #ffa726;
        border-radius: 4px;
        transition: width 0.25s linear;
    }
    .progress-label {
        font-size: 10px;
        color: #888;
        white-space: nowrap;
    }
    .detail-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }
    .field {
        display: flex;
        flex-direction: column;
    }
    .field-full {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
    }
    .field label,
    .field-full label {
        font-size: 11px;
        color: #aaa;
        margin-bottom: 2px;
    }
    .field input,
    .field-full input,
    .field select {
        background: #0f3460;
        color: #e0e0e0;
        border: 1px solid #1a1a4e;
        border-radius: 3px;
        padding: 4px 6px;
        font-size: 12px;
    }
    .field input[type='number'] {
        width: 100%;
    }
    .field-hint {
        font-size: 10px;
        color: #666;
        margin-top: 2px;
    }
    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: #aaa;
        cursor: pointer;
        margin-top: 4px;
    }
    .checkbox-label input[type='checkbox'] {
        margin: 0;
        accent-color: #e94560;
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
    button.small.active {
        background: #e94560;
        border-color: #e94560;
    }
</style>
