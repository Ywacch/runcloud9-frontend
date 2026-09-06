import type { CanvasSnapshot } from '../editor-core/stores/canvasStore'

const LIVE_SESSION_KEY = 'runcloud9_live_session'

interface PersistedLiveSession {
  deploymentId: string
  snapshot: CanvasSnapshot
  /** Epoch ms when this deployment first started provisioning. */
  provisionStartedAt?: number
}

export function persistLiveSession(
  deploymentId: string,
  snapshot: CanvasSnapshot,
): void {
  try {
    const prev = readLiveSessionPersist()
    const provisionStartedAt =
      prev?.deploymentId === deploymentId &&
      typeof prev.provisionStartedAt === 'number'
        ? prev.provisionStartedAt
        : Date.now()
    const payload: PersistedLiveSession = {
      deploymentId,
      snapshot,
      provisionStartedAt,
    }
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
    const provisionStartedAt =
      typeof o.provisionStartedAt === 'number' && Number.isFinite(o.provisionStartedAt)
        ? o.provisionStartedAt
        : undefined
    return {
      deploymentId: o.deploymentId,
      snapshot: o.snapshot as CanvasSnapshot,
      ...(provisionStartedAt != null ? { provisionStartedAt } : {}),
    }
  } catch {
    return null
  }
}

/** Clock start for the provision overlay; null if this deployment is not persisted. */
export function readPersistedProvisionStartedAt(
  deploymentId: string,
): number | null {
  const persisted = readLiveSessionPersist()
  if (persisted?.deploymentId !== deploymentId) return null
  if (
    typeof persisted.provisionStartedAt !== 'number' ||
    !Number.isFinite(persisted.provisionStartedAt)
  ) {
    return null
  }
  return persisted.provisionStartedAt
}
