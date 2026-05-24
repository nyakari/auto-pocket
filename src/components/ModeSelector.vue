<template>
    <div class="section">
        <div class="section-header">
            <label>Action Mode</label>
        </div>
        <div class="mode-toggle">
            <label class="toggle-label" :class="{ active: !localUseScrcpy }">
                <input type="radio" v-model="localUseScrcpy" :value="false" :disabled="disabled" />
                Mouse clicks
            </label>
            <label class="toggle-label" :class="{ active: localUseScrcpy }">
                <input type="radio" v-model="localUseScrcpy" :value="true" :disabled="disabled" />
                scrcpy / ADB taps
            </label>
        </div>
        <div v-if="localUseScrcpy" class="adb-config">
            <label>ADB Executable</label>
            <div class="adb-row">
                <input
                    v-model="localAdbPath"
                    placeholder="e.g. C:\platform-tools\adb.exe"
                    :disabled="disabled"
                />
                <button class="small" @click="onBrowseAdb" :disabled="disabled">Browse</button>
                <button class="small" @click="onDetectResolution" :disabled="disabled">
                    Detect size
                </button>
            </div>
            <div v-if="deviceResolution.width" class="res-info">
                Device: {{ deviceResolution.width }}x{{ deviceResolution.height }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { ref, watch } from 'vue'

    const props = defineProps<{
        useScrcpy: boolean
        adbPath: string
        deviceResolution: { width: number; height: number }
        disabled?: boolean
    }>()

    const emit = defineEmits<{
        'update:useScrcpy': [val: boolean]
        'update:adbPath': [val: string]
        browseAdb: []
        detectResolution: []
    }>()

    const localUseScrcpy = ref(props.useScrcpy)
    const localAdbPath = ref(props.adbPath)

    watch(
        () => props.useScrcpy,
        (val) => {
            localUseScrcpy.value = val
        },
    )
    watch(
        () => props.adbPath,
        (val) => {
            localAdbPath.value = val
        },
    )

    watch(localUseScrcpy, (val) => {
        emit('update:useScrcpy', val)
    })
    watch(localAdbPath, (val) => {
        emit('update:adbPath', val)
    })

    function onBrowseAdb() {
        emit('browseAdb')
    }
    function onDetectResolution() {
        emit('detectResolution')
    }
</script>

<style scoped>
    .section {
        margin-bottom: 16px;
    }
    .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
    }
    .section-header label {
        margin: 0;
        font-size: 12px;
        color: #aaa;
        margin-bottom: 4px;
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
    .mode-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .toggle-label {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: #888;
        cursor: pointer;
        padding: 4px 10px;
        border: 1px solid #0f3460;
        border-radius: 4px;
        background: #16213e;
    }
    .toggle-label.active {
        color: #e0e0e0;
        border-color: #e94560;
        background: #1a1a3e;
    }
    .toggle-label input {
        display: none;
    }
    .res-info {
        font-size: 11px;
        color: #66bb6a;
        margin-top: 4px;
    }
    .adb-config {
        margin-top: 6px;
    }
    .adb-config label {
        display: block;
        font-size: 12px;
        color: #aaa;
        margin-bottom: 4px;
    }
    .adb-row {
        display: flex;
        gap: 6px;
    }
    .adb-row input {
        flex: 1;
        font-size: 11px;
        padding: 3px 6px;
        background: #0f3460;
        color: #e0e0e0;
        border: 1px solid #1a1a4e;
        border-radius: 3px;
    }
    .adb-row input:disabled {
        opacity: 0.5;
    }
</style>
