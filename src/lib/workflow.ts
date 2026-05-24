export type StepType =
    | 'clickXY'
    | 'clickText'
    | 'waitText'
    | 'wait'
    | 'goto'
    | 'condition'
    | 'setVar'
    | 'checkVar'
    | 'swipe'
    | 'countText'
    | 'captureLine'

export interface Step {
    id: string
    type: StepType
    name: string
    waitBeforeMs?: number
    x?: number
    y?: number
    x1?: number
    y1?: number
    x2?: number
    y2?: number
    when?: string
    timeoutMs?: number
    durationMs?: number
    targetStep?: number
    targetStepId?: string
    thenStep?: number
    thenStepId?: string
    elseStep?: number
    elseStepId?: string
    matchMode?: 'first' | 'last' | 'nth'
    matchN?: number
    matchIndex?: number
    wholeWord?: boolean
    varName?: string
    varValue?: string
    persist?: boolean
    duration?: number
}

export interface SavedWorkflow {
    name: string
    steps: Step[]
}

export interface WorkflowProgress {
    elapsed: number
    total: number
    type: string
}

export function getStepLabel(step: Step, index: number): string {
    if (step.name && step.name.trim()) {
        return `Step ${index + 1}: ${step.name.trim()}`
    }
    return `Step ${index + 1}`
}

export function resolveStepIndex(
    steps: Step[],
    stepId: string | undefined,
    legacyIndex: number | undefined,
): number {
    if (stepId) {
        const idx = steps.findIndex((s) => s.id === stepId)
        if (idx !== -1) return idx
    }
    if (legacyIndex !== undefined && legacyIndex >= 1) {
        return legacyIndex - 1
    }
    return -1
}

export function stepSummary(step: Step, steps: Step[], useScrcpy: boolean = false): string {
    switch (step.type) {
        case 'clickXY':
            return `Click at (${step.x ?? '?'}, ${step.y ?? '?'})`
        case 'clickText': {
            const m =
                step.matchMode === 'last'
                    ? 'last'
                    : step.matchMode === 'nth'
                      ? `#${step.matchN ?? 1}`
                      : 'first'
            return `${useScrcpy ? 'Tap' : 'Click'} text: "${step.when || '?'}" (${m} match${step.wholeWord ? ', whole word' : ''}, timeout: ${step.timeoutMs || 5}s)`
        }
        case 'waitText':
            return `Wait for: "${step.when || '?'}" (timeout: ${step.timeoutMs || 10}s)`
        case 'wait':
            return `Wait ${step.durationMs || 1}s`
        case 'goto': {
            const idx = resolveStepIndex(steps, step.targetStepId, step.targetStep)
            if (idx >= 0 && steps[idx]) {
                return `Jump to ${getStepLabel(steps[idx], idx)}`
            }
            if (step.targetStepId) {
                return `Jump to [deleted step]`
            }
            return `Jump to step ${step.targetStep ?? '?'}`
        }
        case 'condition': {
            const thenIdx = resolveStepIndex(steps, step.thenStepId, step.thenStep)
            const elseIdx = resolveStepIndex(steps, step.elseStepId, step.elseStep)
            let thenLabel =
                thenIdx >= 0 && steps[thenIdx]
                    ? getStepLabel(steps[thenIdx], thenIdx)
                    : `step ${step.thenStep ?? '?'}`
            let elseLabel =
                elseIdx === 0
                    ? 'continue'
                    : elseIdx >= 0 && steps[elseIdx]
                      ? getStepLabel(steps[elseIdx], elseIdx)
                      : `step ${step.elseStep ?? 'continue'}`
            if (step.elseStepId === '') elseLabel = 'continue'
            if (!step.elseStepId && (step.elseStep === 0 || step.elseStep === undefined))
                elseLabel = 'continue'
            const ww = step.wholeWord ? ', whole word' : ''
            return `If "${step.when || '?'}" → ${thenLabel}, else → ${elseLabel} (timeout: ${step.timeoutMs || 5}s${ww})`
        }
        case 'setVar':
            return `Set "${step.varName || '?'}" = "${step.varValue || '?'}"${step.persist ? ' [persistent]' : ''}`
        case 'checkVar': {
            const thenIdx = resolveStepIndex(steps, step.thenStepId, step.thenStep)
            const elseIdx = resolveStepIndex(steps, step.elseStepId, step.elseStep)
            let thenLabel =
                thenIdx >= 0 && steps[thenIdx]
                    ? getStepLabel(steps[thenIdx], thenIdx)
                    : `step ${step.thenStep ?? '?'}`
            let elseLabel =
                elseIdx === 0
                    ? 'continue'
                    : elseIdx >= 0 && steps[elseIdx]
                      ? getStepLabel(steps[elseIdx], elseIdx)
                      : `step ${step.elseStep ?? 'continue'}`
            if (step.elseStepId === '') elseLabel = 'continue'
            if (!step.elseStepId && (step.elseStep === 0 || step.elseStep === undefined))
                elseLabel = 'continue'
            return `If "${step.varName || '?'}" == "${step.varValue || '?'}" → ${thenLabel}, else → ${elseLabel}`
        }
        case 'swipe':
            return `Swipe (${step.x1 ?? 0},${step.y1 ?? 0}) → (${step.x2 ?? 0},${step.y2 ?? 0}) (${step.duration ?? 0.3}s)`
        case 'countText':
            return `Count "${step.when || '?'}" → var "${step.varName || '?'}"`
        case 'captureLine': {
            const m =
                step.matchMode === 'last'
                    ? 'last'
                    : step.matchMode === 'nth'
                      ? `#${step.matchN ?? 1}`
                      : 'first'
            return `Capture "${step.when || '?'}" (${m} match${step.wholeWord ? ', whole word' : ''}) → var "${step.varName || '?'}"${step.persist ? ' [persistent]' : ''}`
        }
    }
    return ''
}

export function resetStepFields(step: Step) {
    delete step.x
    delete step.y
    delete step.when
    delete step.timeoutMs
    delete step.durationMs
    delete step.targetStep
    delete step.targetStepId
    delete step.thenStep
    delete step.thenStepId
    delete step.elseStep
    delete step.elseStepId
    delete step.matchIndex
    delete step.matchMode
    delete step.matchN
    delete step.varName
    delete step.varValue
    delete step.persist
    delete step.x1
    delete step.y1
    delete step.x2
    delete step.y2
    delete step.duration
}

export function setStepDefaults(step: Step, steps: Step[]) {
    switch (step.type) {
        case 'clickXY':
            step.x = 0
            step.y = 0
            break
        case 'clickText':
            step.when = ''
            step.timeoutMs = 5
            step.matchMode = 'first'
            step.matchN = 1
            step.wholeWord = false
            break
        case 'waitText':
            step.when = ''
            step.timeoutMs = 10
            break
        case 'wait':
            step.durationMs = 1
            break
        case 'goto':
            if (steps.length > 0) {
                step.targetStepId = steps[0].id
                step.targetStep = 1
            } else {
                step.targetStep = 1
            }
            break
        case 'condition':
            step.when = ''
            if (steps.length > 0) {
                step.thenStepId = steps[0].id
                step.thenStep = 1
            } else {
                step.thenStep = 1
            }
            step.elseStepId = ''
            step.elseStep = 0
            step.timeoutMs = 5
            step.wholeWord = false
            break
        case 'setVar':
            step.varName = ''
            step.varValue = ''
            step.persist = false
            break
        case 'checkVar':
            step.varName = ''
            step.varValue = ''
            if (steps.length > 0) {
                step.thenStepId = steps[0].id
                step.thenStep = 1
            } else {
                step.thenStep = 1
            }
            step.elseStepId = ''
            step.elseStep = 0
            break
        case 'swipe':
            step.x1 = 0
            step.y1 = 0
            step.x2 = 0
            step.y2 = 0
            step.duration = 0.3
            break
        case 'countText':
            step.when = ''
            step.varName = ''
            step.timeoutMs = 5
            break
        case 'captureLine':
            step.when = ''
            step.varName = ''
            step.timeoutMs = 5
            step.matchMode = 'last'
            step.matchN = 1
            step.persist = false
            step.wholeWord = false
            break
    }
}

export function createStep(defaultWaitMs: number = 0.5): Step {
    return {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        type: 'clickXY',
        name: '',
        waitBeforeMs: defaultWaitMs,
        x: 0,
        y: 0,
    }
}

export function moveStep(steps: Step[], fromIndex: number, toIndex: number): Step[] {
    if (fromIndex < 0 || fromIndex >= steps.length) return steps
    if (toIndex < 0 || toIndex >= steps.length) return steps
    if (fromIndex === toIndex) return steps

    const result = [...steps]
    const [removed] = result.splice(fromIndex, 1)
    result.splice(toIndex, 0, removed)
    return result
}
