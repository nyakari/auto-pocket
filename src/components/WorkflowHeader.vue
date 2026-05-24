<template>
    <div class="section">
        <label>Workflow Name</label>
        <input
            v-model="localName"
            placeholder="e.g. Battle Auto-Farm"
            :disabled="disabled"
            class="custom-input"
        />
        <div class="wf-select-row" v-if="savedWorkflows.length > 0">
            <div class="select-wrapper">
                <select
                    v-model="selectedWfName"
                    @change="onLoad"
                    :disabled="disabled"
                    class="custom-select"
                >
                    <option value="">-- Load Saved Workflow --</option>
                    <option v-for="wf in savedWorkflows" :key="wf.name" :value="wf.name">
                        {{ wf.name }}
                    </option>
                </select>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { ref, watch } from 'vue'
    import type { SavedWorkflow } from '../lib/workflow'

    const props = defineProps<{
        workflowName: string
        savedWorkflows: SavedWorkflow[]
        disabled?: boolean
    }>()

    const emit = defineEmits<{
        'update:workflowName': [name: string]
        load: [name: string]
    }>()

    const selectedWfName = ref('')
    const localName = ref(props.workflowName)

    watch(
        () => props.workflowName,
        (val) => {
            localName.value = val
        },
    )

    watch(localName, (val) => {
        emit('update:workflowName', val)
    })

    function onLoad() {
        if (selectedWfName.value) {
            emit('load', selectedWfName.value)
            selectedWfName.value = ''
        }
    }
</script>

<style scoped>
    .section {
        margin-bottom: 20px;
    }

    label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
        margin-bottom: 6px;
        letter-spacing: 0.2px;
    }

    .custom-input {
        width: 100%;
        background: var(--bg-main);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 10px 14px;
        font-size: 14px;
        outline: none;
        transition:
            border-color var(--transition-fast),
            box-shadow var(--transition-fast);
    }

    .custom-input:focus {
        border-color: var(--color-accent);
        box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.15);
    }

    .custom-input:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .wf-select-row {
        margin-top: 10px;
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
        padding: 10px 14px;
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
        right: 14px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
    }

    .custom-select:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
</style>
