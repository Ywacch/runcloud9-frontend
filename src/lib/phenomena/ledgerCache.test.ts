import { describe, expect, it } from 'vitest'
import type { PhenomenonEntry } from './types'
import {
  clearLedgerCache,
  ledgerCacheKey,
  loadLedgerCache,
  saveLedgerCache,
} from './ledgerCache'

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

const sampleEntry: PhenomenonEntry = {
  phenomenon: 'reply_before_parent',
  fidelity: 'simulated',
  cost: { readsAffected: 1 },
  baseRate: { perThousand: 10, denominator: 'all thread reads', reads: 100 },
  sources: ['app'],
}

describe('ledgerCache', () => {
  it('save, load, and clear round-trip', () => {
    const storage = new MemoryStorage()
    const ns = 'cloud9-social-feed-abc'
    expect(ledgerCacheKey(ns)).toBe('c9:ledger:cloud9-social-feed-abc')
    saveLedgerCache(storage, ns, sampleEntry, '2026-06-01T12:00:00.000Z')
    const loaded = loadLedgerCache(storage, ns)
    expect(loaded?.entry.phenomenon).toBe('reply_before_parent')
    expect(loaded?.at).toBe('2026-06-01T12:00:00.000Z')
    clearLedgerCache(storage, ns)
    expect(loadLedgerCache(storage, ns)).toBeUndefined()
  })
})
