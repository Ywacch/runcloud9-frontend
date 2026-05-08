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
  addLog: (line: LogLine) => void
  addBatch: (lines: LogLine[]) => void
  clearLogs: () => void
}

const MAX_LOGS = 3000

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  addLog: (line) =>
    set((s) => ({
      logs: [...s.logs, line].slice(-MAX_LOGS),
    })),
  addBatch: (lines) =>
    set((s) => ({
      logs: [...s.logs, ...lines].slice(-MAX_LOGS),
    })),
  clearLogs: () => set({ logs: [] }),
}))
