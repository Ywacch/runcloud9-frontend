import { create } from 'zustand'

export interface LogLine {
  timestamp: string
  component: string
  level?: string
  message: string
  fields?: Record<string, unknown>
}

interface LogState {
  logs: LogLine[]
  activeTraceId: string | null
  addLog: (line: LogLine) => void
  addBatch: (lines: LogLine[]) => void
  clearLogs: () => void
  setActiveTraceId: (id: string | null) => void
}

const MAX_LOGS = 3000

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  activeTraceId: null,
  addLog: (line) =>
    set((s) => ({
      logs: [...s.logs, line].slice(-MAX_LOGS),
    })),
  addBatch: (lines) =>
    set((s) => ({
      logs: [...s.logs, ...lines].slice(-MAX_LOGS),
    })),
  clearLogs: () => set({ logs: [] }),
  setActiveTraceId: (id) => set({ activeTraceId: id }),
}))
