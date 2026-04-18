import type { CanvasSnapshot } from '../store/canvasStore'

const LIVE_SESSION_KEY = 'cloud9_live_session'

interface PersistedLiveSession {
  deploymentId: string
  snapshot: CanvasSnapshot
}

export function persistLiveSession(
  deploymentId: string,
  snapshot: CanvasSnapshot,
): void {
  try {
    const payload: PersistedLiveSession = { deploymentId, snapshot }
    localStorage.setItem(LIVE_SESSION_KEY, JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

export function clearLiveSessionPersist(): void {
  try {
    localStorage.removeItem(LIVE_SESSION_KEY)
  } catch {
    /* */
  }
}

export function readLiveSessionPersist(): PersistedLiveSession | null {
  try {
    const raw = localStorage.getItem(LIVE_SESSION_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as Partial<PersistedLiveSession>
    if (
      typeof o.deploymentId !== 'string' ||
      !o.snapshot ||
      o.snapshot.version !== '1.0' ||
      !Array.isArray(o.snapshot.nodes) ||
      !Array.isArray(o.snapshot.edges)
    ) {
      return null
    }
    return { deploymentId: o.deploymentId, snapshot: o.snapshot as CanvasSnapshot }
  } catch {
    return null
  }
}
