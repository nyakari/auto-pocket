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
}

export interface WorkflowStepBase {
    id: string
    name: string
    waitBeforeMs: number
}

export interface WorkflowStepClickXY extends WorkflowStepBase {
    type: 'clickXY'
    x: number
    y: number
}

export interface WorkflowStepClickText extends WorkflowStepBase {
    type: 'clickText'
    when: string
    timeoutMs: number
    matchIndex: number
    wholeWord?: boolean
}

export interface WorkflowStepWaitText extends WorkflowStepBase {
    type: 'waitText'
    when: string
    timeoutMs: number
}

export interface WorkflowStepWait extends WorkflowStepBase {
    type: 'wait'
    durationMs: number
}

export interface WorkflowStepGoto extends WorkflowStepBase {
    type: 'goto'
    targetStep: number
}

export interface WorkflowStepCondition extends WorkflowStepBase {
    type: 'condition'
    when: string
    thenStep: number
    elseStep: number
    timeoutMs: number
    wholeWord?: boolean
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
}

export interface WorkflowStepCaptureLine extends WorkflowStepBase {
    type: 'captureLine'
    when: string
    matchIndex: number
    varName: string
    timeoutMs: number
    persist?: boolean
    wholeWord?: boolean
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
