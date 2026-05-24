<template>
    <div class="section">
        <label>Action Mode</label>
        <div class="toggle-group">
            <button
                type="button"
                class="toggle-btn"
                :class="{ active: !localUseScrcpy }"
                @click="localUseScrcpy = false"
                :disabled="disabled"
            >
                🖱️ Mouse Control
            </button>
            <button
                type="button"
                class="toggle-btn"
                :class="{ active: localUseScrcpy }"
                @click="localUseScrcpy = true"
                :disabled="disabled"
            >
                📱 scrcpy / ADB
            </button>
        </div>

        <div v-if="localUseScrcpy" class="adb-config">
            <label>ADB Executable Path</label>
            <div class="adb-row">
                <input
                    v-model="localAdbPath"
                    placeholder="e.g. C:\platform-tools\adb.exe"
                    :disabled="disabled"
                    class="custom-input"
                />
                <button
                    class="btn btn-secondary btn-small"
                    @click="onBrowseAdb"
                    :disabled="disabled"
                >
                    Browse
                </button>
                <button
                    class="btn btn-secondary btn-small"
                    @click="onDetectResolution"
                    :disabled="disabled"
                >
                    Detect Size
                </button>
            </div>
            <div v-if="deviceResolution.width" class="res-info">
                <span class="icon">✅</span> Device: {{ deviceResolution.width }}x{{
                    deviceResolution.height
                }}
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

    /* Toggle Switches for Action Mode */
    .toggle-group {
        display: flex;
        background: var(--bg-main);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 4px;
        gap: 4px;
    }

    .toggle-btn {
        flex: 1;
        background: transparent;
        border: none;
        color: var(--text-secondary);
        padding: 8px;
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all var(--transition-fast);
    }

    .toggle-btn:hover:not(:disabled) {
        color: var(--text-primary);
        background: rgba(255, 255, 255, 0.02);
    }

    .toggle-btn.active {
        background: var(--color-accent);
        color: white;
        box-shadow: 0 2px 8px rgba(244, 63, 94, 0.3);
    }

    .adb-config {
        margin-top: 12px;
        animation: fadeIn 0.2s ease-out;
    }

    .adb-row {
        display: flex;
        gap: 8px;
    }

    .custom-input {
        flex: 1;
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
    }

    .custom-input:focus {
        border-color: var(--color-accent);
        box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.15);
    }

    .custom-input:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    /* Buttons */
    .btn {
        padding: 8px 14px;
        border-radius: var(--radius-md);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all var(--transition-fast);
        border: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .btn-secondary {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
    }
    .btn-secondary:hover:not(:disabled) {
        background: var(--bg-card-hover);
        border-color: var(--border-hover);
    }

    .btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .res-info {
        font-size: 11px;
        color: var(--color-success);
        margin-top: 6px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(4px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
</style>
