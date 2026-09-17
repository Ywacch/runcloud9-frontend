import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_LOGS, MAX_QUIET_LOGS, useLogStore, type RawLogLine } from './logStore'

function line(component: string, message: string): RawLogLine {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    component,
    message,
  }
}

describe('logStore', () => {
  beforeEach(() => {
    useLogStore.getState().clearLogs()
  })

  it('normalizes postgres/redis aliases on ingest', () => {
    useLogStore.getState().addLog(line('postgres', 'ready'))
    useLogStore.getState().addLog(line('redis', 'PONG'))
    const components = useLogStore.getState().logs.map((l) => l.component)
    expect(components).toEqual(['db', 'cache'])
  })

  it('keeps db lines when app-server floods the ring', () => {
    useLogStore.getState().addLog(line('db', 'checkpoint complete'))
    useLogStore.getState().addBatch(
      Array.from({ length: MAX_LOGS }, (_, i) => line('app-server', `req ${i}`)),
    )
    const logs = useLogStore.getState().logs
    expect(logs.length).toBe(MAX_LOGS)
    expect(logs.some((l) => l.component === 'db' && l.message === 'checkpoint complete')).toBe(
      true,
    )
  })

  it('caps quiet infra logs so they cannot fill the whole buffer', () => {
    useLogStore.getState().addBatch(
      Array.from({ length: MAX_QUIET_LOGS + 50 }, (_, i) => line('db', `sql ${i}`)),
    )
    useLogStore.getState().addBatch(
      Array.from({ length: MAX_LOGS }, (_, i) => line('app-server', `req ${i}`)),
    )
    const logs = useLogStore.getState().logs
    const quiet = logs.filter((l) => l.component === 'db')
    expect(logs.length).toBe(MAX_LOGS)
    expect(quiet.length).toBe(MAX_QUIET_LOGS)
    expect(quiet[0]?.message).toBe('sql 50')
  })
})
