export interface PedagogyTimerStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function pedagogyTimerKey(namespace: string): string {
  return `c9:pedagogy:first-violation:${namespace}`
}

/** Record the first violation time for a namespace. Returns true when newly recorded. */
export function noteFirstViolation(
  storage: PedagogyTimerStorage,
  namespace: string,
  at?: number,
): boolean {
  if (!namespace.trim()) return false
  const key = pedagogyTimerKey(namespace)
  if (storage.getItem(key) != null) return false
  const ts = at ?? Date.now()
  try {
    storage.setItem(key, String(ts))
    return true
  } catch {
    return false
  }
}

export function msSinceFirstViolation(
  storage: PedagogyTimerStorage,
  namespace: string,
  now?: number,
): number | null {
  if (!namespace.trim()) return null
  const raw = storage.getItem(pedagogyTimerKey(namespace))
  if (raw == null) return null
  const at = Number(raw)
  if (!Number.isFinite(at)) return null
  const t = now ?? Date.now()
  return Math.max(0, t - at)
}

export function clearPedagogyTimer(storage: PedagogyTimerStorage, namespace: string): void {
  if (!namespace.trim()) return
  try {
    storage.removeItem(pedagogyTimerKey(namespace))
  } catch {
    /* ignore */
  }
}

export function pedagogyCardOpenedKey(namespace: string): string {
  return `c9:pedagogy:card-opened:${namespace}`
}

/** Returns true the first time per namespace (session). */
export function markLabCardOpened(
  storage: PedagogyTimerStorage,
  namespace: string,
): boolean {
  if (!namespace.trim()) return false
  const key = pedagogyCardOpenedKey(namespace)
  if (storage.getItem(key) != null) return false
  try {
    storage.setItem(key, '1')
    return true
  } catch {
    return false
  }
}
