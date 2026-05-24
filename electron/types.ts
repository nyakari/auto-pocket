export interface SavedConfig {
    targetWindowTitle: string
    pollInterval: number
    ocrLang: string
    ocrScale: number
    rules: SavedRule[]
    workflows: Workflow[]
    defaultWaitMs: number
    useScrcpy: boolean
    deviceResolution: { width: number; height: number }
    adbPath: string
}

export interface SavedRule {
    name: string
    when: string
    action: string
    actionText?: string
    useRegex?: boolean
}

export interface WatcherMatchEvent {
    ruleName: string
    matchedText: string
    screenOffset: { x: number; y: number }
    blocks: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }>
}

export interface Workflow {
    name: string
    steps: WorkflowStep[]
    startIndex?: number
    windowWidth?: number
    windowHeight?: number
}

export interface WorkflowStepBase {
    id: string
    name: string
    waitBeforeMs: number
    onError?: 'stop' | 'ignore' | 'goto'
    onErrorStepId?: string
    onErrorStep?: number
}

export interface WorkflowStepClickXY extends WorkflowStepBase {
    type: 'clickXY'
    x: number
    y: number
    clickType?: 'left' | 'right' | 'middle' | 'double'
}

export interface WorkflowStepClickText extends WorkflowStepBase {
    type: 'clickText'
    when: string
    timeoutMs: number
    matchIndex: number
    wholeWord?: boolean
    clickType?: 'left' | 'right' | 'middle' | 'double'
    useRegex?: boolean
}

export interface WorkflowStepWaitText extends WorkflowStepBase {
    type: 'waitText'
    when: string
    timeoutMs: number
    useRegex?: boolean
}

export interface WorkflowStepWait extends WorkflowStepBase {
    type: 'wait'
    durationMs: number
}

export interface WorkflowStepGoto extends WorkflowStepBase {
    type: 'goto'
    targetStep: number
    targetStepId?: string
}

export interface WorkflowStepCondition extends WorkflowStepBase {
    type: 'condition'
    when: string
    thenStep: number
    elseStep: number
    timeoutMs: number
    wholeWord?: boolean
    useRegex?: boolean
    thenStepId?: string
    elseStepId?: string
}

export interface WorkflowStepSetVar extends WorkflowStepBase {
    type: 'setVar'
    varName: string
    varValue: string
    persist?: boolean
}

export interface WorkflowStepCheckVar extends WorkflowStepBase {
    type: 'checkVar'
    varName: string
    varValue: string
    thenStep: number
    elseStep: number
    thenStepId?: string
    elseStepId?: string
}

export interface WorkflowStepSwipe extends WorkflowStepBase {
    type: 'swipe'
    x1: number
    y1: number
    x2: number
    y2: number
    duration: number
}

export interface WorkflowStepCountText extends WorkflowStepBase {
    type: 'countText'
    when: string
    varName: string
    timeoutMs: number
    useRegex?: boolean
}

export interface WorkflowStepCaptureLine extends WorkflowStepBase {
    type: 'captureLine'
    when: string
    matchIndex: number
    varName: string
    timeoutMs: number
    persist?: boolean
    wholeWord?: boolean
    useRegex?: boolean
}

export interface WorkflowStepCallWorkflow extends WorkflowStepBase {
    type: 'callWorkflow'
    targetWorkflow: string
}

export interface WorkflowStepPressKey extends WorkflowStepBase {
    type: 'pressKey'
    key: string
    modifiers?: string[]
}

export interface WorkflowStepCaptureImage extends WorkflowStepBase {
    type: 'captureImage'
    folderPath?: string
    fileName?: string
}

export interface WorkflowStepHoverXY extends WorkflowStepBase {
    type: 'hoverXY'
    x: number
    y: number
}

export interface WorkflowStepHoverText extends WorkflowStepBase {
    type: 'hoverText'
    when: string
    timeoutMs: number
    matchIndex: number
    wholeWord?: boolean
    useRegex?: boolean
}

export interface WorkflowStepMathVar extends WorkflowStepBase {
    type: 'mathVar'
    varName: string
    expression: string
    persist?: boolean
}

export interface WorkflowStepRepeat extends WorkflowStepBase {
    type: 'repeat'
    targetStepId?: string
    targetStep?: number
    repeatCount: number
}

export type WorkflowStep =
    | WorkflowStepClickXY
    | WorkflowStepClickText
    | WorkflowStepWaitText
    | WorkflowStepWait
    | WorkflowStepGoto
    | WorkflowStepCondition
    | WorkflowStepSetVar
    | WorkflowStepCheckVar
    | WorkflowStepSwipe
    | WorkflowStepCountText
    | WorkflowStepCaptureLine
    | WorkflowStepCallWorkflow
    | WorkflowStepPressKey
    | WorkflowStepCaptureImage
    | WorkflowStepHoverXY
    | WorkflowStepHoverText
    | WorkflowStepMathVar
    | WorkflowStepRepeat

export interface WorkflowStepEvent {
    workflowName: string
    stepIndex: number
    step: WorkflowStep
    status: 'running' | 'success' | 'error' | 'skipped'
    message?: string
    matchedText?: string
    matchedBbox?: { x0: number; y0: number; x1: number; y1: number }
}

export interface WorkflowProgress {
    workflowName: string
    stepIndex: number
    type: 'waitBefore' | 'waitStep' | 'timeout'
    elapsed: number
    total: number
    runId: number
}

export interface WorkflowResult {
    workflowName: string
    status: 'completed' | 'stopped' | 'error'
    completedSteps: number
    totalSteps: number
    error?: string
}
