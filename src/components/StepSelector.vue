<template>
    <div class="select-wrapper">
        <select v-model="selectedId" :disabled="disabled" class="custom-select">
            <option v-if="includeContinue" value="">-- Continue (next step) --</option>
            <option v-for="s in availableSteps" :key="s.step.id" :value="s.step.id">
                {{ s.label }}
            </option>
        </select>
    </div>
</template>

<script setup lang="ts">
    import { ref, watch, computed } from 'vue'
    import type { Step } from '../lib/workflow'
    import { getStepLabel } from '../lib/workflow'

    const props = defineProps<{
        steps: Step[]
        currentStepIndex?: number
        modelValue?: string
        includeContinue?: boolean
        disabled?: boolean
    }>()

    const emit = defineEmits<{
        'update:modelValue': [id: string]
    }>()

    const selectedId = ref(props.modelValue ?? '')

    watch(
        () => props.modelValue,
        (val) => {
            selectedId.value = val ?? ''
        },
    )

    watch(selectedId, (val) => {
        emit('update:modelValue', val)
    })

    const availableSteps = computed(() => {
        return props.steps
            .map((step, idx) => ({
                step,
                idx,
                label: getStepLabel(step, idx),
            }))
            .filter((item) => item.idx !== (props.currentStepIndex ?? -1))
    })
</script>

<style scoped>
    .select-wrapper {
        position: relative;
        width: 100%;
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

    .custom-select:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
</style>
