import { describe, expect, it } from 'vitest'
import {
  clearPedagogyTimer,
  markLabCardOpened,
  msSinceFirstViolation,
  noteFirstViolation,
  pedagogyTimerKey,
} from './pedagogyTimer'

class MemoryStorage implements Storage {
  private map = new Map<string, string>()

  get length() {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
}

describe('pedagogyTimer', () => {
  it('returns null when no violation was recorded', () => {
    const storage = new MemoryStorage()
    expect(msSinceFirstViolation(storage, 'ns-a')).toBeNull()
  })

  it('computes elapsed ms from the stored timestamp', () => {
    const storage = new MemoryStorage()
    noteFirstViolation(storage, 'ns-a', 1_000)
    expect(msSinceFirstViolation(storage, 'ns-a', 4_500)).toBe(3_500)
  })

  it('isolates namespaces', () => {
    const storage = new MemoryStorage()
    noteFirstViolation(storage, 'ns-a', 100)
    noteFirstViolation(storage, 'ns-b', 500)
    expect(msSinceFirstViolation(storage, 'ns-a', 200)).toBe(100)
    expect(msSinceFirstViolation(storage, 'ns-b', 600)).toBe(100)
  })

  it('noteFirstViolation only records once', () => {
    const storage = new MemoryStorage()
    expect(noteFirstViolation(storage, 'ns-a', 10)).toBe(true)
    expect(noteFirstViolation(storage, 'ns-a', 99)).toBe(false)
    expect(msSinceFirstViolation(storage, 'ns-a', 20)).toBe(10)
  })

  it('clearPedagogyTimer removes the entry', () => {
    const storage = new MemoryStorage()
    noteFirstViolation(storage, 'ns-a', 1)
    clearPedagogyTimer(storage, 'ns-a')
    expect(storage.getItem(pedagogyTimerKey('ns-a'))).toBeNull()
  })

  it('markLabCardOpened only returns true once per namespace', () => {
    const storage = new MemoryStorage()
    expect(markLabCardOpened(storage, 'ns-a')).toBe(true)
    expect(markLabCardOpened(storage, 'ns-a')).toBe(false)
  })
})
