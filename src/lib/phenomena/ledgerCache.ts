import type { PhenomenonEntry } from './types'

export interface LedgerCacheRecord {
  entry: PhenomenonEntry
  at: string
}

export function ledgerCacheKey(namespace: string): string {
  return `c9:ledger:${namespace}`
}

export function saveLedgerCache(
  storage: Storage,
  namespace: string,
  entry: PhenomenonEntry,
  at: string,
): void {
  if (!namespace.trim()) return
  const payload: LedgerCacheRecord = { entry, at }
  try {
    storage.setItem(ledgerCacheKey(namespace), JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

export function loadLedgerCache(
  storage: Storage,
  namespace: string,
): LedgerCacheRecord | undefined {
  if (!namespace.trim()) return undefined
  try {
    const raw = storage.getItem(ledgerCacheKey(namespace))
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as LedgerCacheRecord
    if (!parsed?.entry || typeof parsed.at !== 'string') return undefined
    return parsed
  } catch {
    return undefined
  }
}

export function clearLedgerCache(storage: Storage, namespace: string): void {
  if (!namespace.trim()) return
  try {
    storage.removeItem(ledgerCacheKey(namespace))
  } catch {
    /* ignore */
  }
}
