import { create } from 'zustand'
import { isQuietLogComponent, normalizeLogComponent } from '../../lib/logComponent'

export interface LogLine {
  /** Monotonically increasing ID, stable across ring-buffer rotations. */
  id: number
  timestamp: string
  component: string
  pod?: string
  level?: string
  message: string
  fields?: Record<string, unknown>
}

/** Shape callers (e.g. the WS sync hook) pass in; the store assigns `id`. */
export type RawLogLine = Omit<LogLine, 'id'>

interface LogState {
  logs: LogLine[]
  activeTraceId: string | null
  pendingInspectorTab: 'logs' | null
  inspectorTabNonce: number
  addLog: (line: RawLogLine) => void
  addBatch: (lines: RawLogLine[]) => void
  clearLogs: () => void
  setActiveTraceId: (id: string | null) => void
  requestInspectorTab: (tab: 'logs') => void
  takePendingInspectorTab: () => 'logs' | null
}

/**
 * Ring-buffer cap. 1500 keeps roughly the last ~5 minutes of structured logs at
 * 50 RPS, which is plenty for live inspection while halving steady-state memory
 * vs the previous 3000.
 */
export const MAX_LOGS = 1500

/** Reserved slots so db/cache/mq/lb are not evicted by app-server floods. */
export const MAX_QUIET_LOGS = 400

let _nextId = 1

function stamp(line: RawLogLine): LogLine {
  return {
    ...line,
    id: _nextId++,
    component: normalizeLogComponent(line.component),
  }
}

/** Mutates `arr` in place to keep at most `MAX_LOGS` trailing entries. */
function trimInPlace(arr: LogLine[]): void {
  if (arr.length <= MAX_LOGS) return
  const quiet: LogLine[] = []
  const noisy: LogLine[] = []
  for (const line of arr) {
    if (isQuietLogComponent(line.component)) quiet.push(line)
    else noisy.push(line)
  }
  const keptQuiet =
    quiet.length > MAX_QUIET_LOGS ? quiet.slice(-MAX_QUIET_LOGS) : quiet
  const noisyBudget = Math.max(0, MAX_LOGS - keptQuiet.length)
  const keptNoisy =
    noisy.length > noisyBudget ? noisy.slice(-noisyBudget) : noisy
  const keep = new Set<number>()
  for (const line of keptQuiet) keep.add(line.id)
  for (const line of keptNoisy) keep.add(line.id)
  let write = 0
  for (const line of arr) {
    if (keep.has(line.id)) {
      arr[write++] = line
    }
  }
  arr.length = write
}

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  activeTraceId: null,
  pendingInspectorTab: null,
  inspectorTabNonce: 0,
  addLog: (line) =>
    set((s) => {
      const next = s.logs.concat(stamp(line))
      trimInPlace(next)
      return { logs: next }
    }),
  addBatch: (lines) =>
    set((s) => {
      if (lines.length === 0) return s
      const next = s.logs.concat(lines.map(stamp))
      trimInPlace(next)
      return { logs: next }
    }),
  clearLogs: () => set({ logs: [] }),
  setActiveTraceId: (id) => set({ activeTraceId: id }),
  requestInspectorTab: (tab) =>
    set((s) => ({
      pendingInspectorTab: tab,
      inspectorTabNonce: s.inspectorTabNonce + 1,
    })),
  takePendingInspectorTab: () => {
    const tab = get().pendingInspectorTab
    if (tab) set({ pendingInspectorTab: null })
    return tab
  },
}))
