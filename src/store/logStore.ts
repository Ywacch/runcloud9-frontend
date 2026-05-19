import { create } from 'zustand'

export interface LogLine {
  /** Monotonically increasing ID, stable across ring-buffer rotations. */
  id: number
  timestamp: string
  component: string
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

const MAX_LOGS = 3000
let _nextId = 1

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  activeTraceId: null,
  addLog: (line) =>
    set((s) => ({
      logs: [...s.logs, { ...line, id: _nextId++ }].slice(-MAX_LOGS),
    })),
  addBatch: (lines) =>
    set((s) => ({
      logs: [
        ...s.logs,
        ...lines.map((l) => ({ ...l, id: _nextId++ })),
      ].slice(-MAX_LOGS),
    })),
  clearLogs: () => set({ logs: [] }),
  setActiveTraceId: (id) => set({ activeTraceId: id }),
}))
