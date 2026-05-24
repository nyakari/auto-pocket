<template>
    <select v-model="selectedId" :disabled="disabled">
        <option v-if="includeContinue" value="">-- Continue (next step) --</option>
        <option v-for="s in availableSteps" :key="s.step.id" :value="s.step.id">
            {{ s.label }}
        </option>
    </select>
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
    select {
        width: 100%;
        background: #1e1e1e;
        color: #ececec;
        border: 1px solid #2a2a2a;
        border-radius: 3px;
        padding: 4px 6px;
        font-size: 12px;
    }
    select:focus {
        border-color: #404040;
        outline: none;
    }
    select:disabled {
        opacity: 0.5;
    }
</style>
