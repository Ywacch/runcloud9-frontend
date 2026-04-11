import { create } from 'zustand'

export interface LogLine {
  timestamp: string
  component: string
  message: string
}

interface LogState {
  logs: LogLine[]
  addLog: (line: LogLine) => void
  addBatch: (lines: LogLine[]) => void
  clearLogs: () => void
}

const MAX_LOGS = 500

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
