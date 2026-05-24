<template>
    <div class="section">
        <label>Workflow Name</label>
        <input v-model="localName" placeholder="e.g. Battle Auto-Farm" :disabled="disabled" />
        <div class="wf-select-row" v-if="savedWorkflows.length > 0">
            <select v-model="selectedWfName" @change="onLoad">
                <option value="">-- Load saved --</option>
                <option v-for="wf in savedWorkflows" :key="wf.name" :value="wf.name">
                    {{ wf.name }}
                </option>
            </select>
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
        margin-bottom: 16px;
    }
    .section label {
        display: block;
        font-size: 12px;
        color: #9ca3af;
        margin-bottom: 4px;
    }
    .section input,
    .section select {
        width: 100%;
        background: #1e1e1e;
        color: #ececec;
        border: 1px solid #2a2a2a;
        border-radius: 4px;
        padding: 6px 8px;
        font-size: 13px;
    }
    .section input:focus,
    .section select:focus {
        border-color: #404040;
        outline: none;
    }
    .section input:disabled {
        opacity: 0.5;
    }
    .wf-select-row {
        margin-top: 6px;
    }
</style>
