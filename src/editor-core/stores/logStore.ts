import { create } from 'zustand'

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
  addLog: (line: RawLogLine) => void
  addBatch: (lines: RawLogLine[]) => void
  clearLogs: () => void
  setActiveTraceId: (id: string | null) => void
}

/**
 * Ring-buffer cap. 1500 keeps roughly the last ~5 minutes of structured logs at
 * 50 RPS, which is plenty for live inspection while halving steady-state memory
 * vs the previous 3000.
 */
const MAX_LOGS = 1500
let _nextId = 1

/** Mutates `arr` in place to keep at most `MAX_LOGS` trailing entries. */
function trimInPlace(arr: LogLine[]): void {
  const overflow = arr.length - MAX_LOGS
  if (overflow > 0) arr.splice(0, overflow)
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  activeTraceId: null,
  addLog: (line) =>
    set((s) => {
      const next = s.logs.concat({ ...line, id: _nextId++ })
      trimInPlace(next)
      return { logs: next }
    }),
  addBatch: (lines) =>
    set((s) => {
      if (lines.length === 0) return s
      const stamped = lines.map((l) => ({ ...l, id: _nextId++ }))
      const next = s.logs.concat(stamped)
      trimInPlace(next)
      return { logs: next }
    }),
  clearLogs: () => set({ logs: [] }),
  setActiveTraceId: (id) => set({ activeTraceId: id }),
}))
