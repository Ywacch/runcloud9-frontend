import { useEffect } from 'react'
import { parseRunningAtMs } from '../../lib/sessionMinutes'
import { getDeployment } from '../../lib/api'
import {
  clearLiveSessionPersist,
  readLiveSessionPersist,
} from '../../lib/liveSessionStorage'
import {
  ensureClientLoadgenMetrics,
  spawnClientLoadgenNode,
} from '../../lib/spawnClientNode'
import { useCanvasStore } from '../stores/canvasStore'
import { useLogStore } from '../stores/logStore'
import { useMetricsStore } from '../stores/metricsStore'

const ACTIVE_STATUSES = new Set(['running', 'provisioning', 'queued'])

/**
 * On mount, if sessionStorage has a live session, verify it with the API and
 * restore canvas + live mode (metrics/logs reconnect via deploymentId).
 */
export function useDeploymentRehydrate(): void {
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const persisted = readLiveSessionPersist()
      if (!persisted) return
      try {
        const row = await getDeployment(persisted.deploymentId)
        if (cancelled) return
        if (!ACTIVE_STATUSES.has(row.status)) {
          clearLiveSessionPersist()
          return
        }

        const st = useCanvasStore.getState()
        st.loadJSON(persisted.snapshot)
        st.setDeploymentId(persisted.deploymentId)

        const ids = Object.keys(useCanvasStore.getState().nodes)
        const nodeStatus = row.status === 'running' ? 'healthy' : 'provisioning'
        for (const nid of ids) {
          const n = useCanvasStore.getState().nodes[nid]
          if (!n || n.type === 'client') continue
          useCanvasStore.getState().updateNodeStatus(nid, nodeStatus)
        }

        const expiresMs = Date.parse(row.expiresAt)
        const hasExpiresAt = Number.isFinite(expiresMs)
        if (row.status === 'running') {
          useCanvasStore.getState().setAllEdgesAnimated(true)
          useCanvasStore.getState().setLiveSessionEndsAt(
            hasExpiresAt ? expiresMs : Date.now() + 9 * 60 * 1000,
          )
          useCanvasStore.getState().setLiveSessionStartedAt(
            parseRunningAtMs(row.metricsSummary as Record<string, unknown> | undefined) ??
              Date.now(),
          )
          spawnClientLoadgenNode()
          const fin = useCanvasStore.getState()
          fin.setMode('live')
          fin.selectNode(null)
          fin.setPendingSource(null)
          fin.setPlacingNodeType(null)
          fin.setDesignTool('select')
        } else {
          useCanvasStore.getState().setAllEdgesAnimated(false)
          useCanvasStore.getState().setLiveSessionEndsAt(null)
          useCanvasStore.getState().setLiveSessionStartedAt(null)
          const fin = useCanvasStore.getState()
          fin.setMode('design')
          fin.selectNode(null)
          fin.setPendingSource(null)
          fin.setPlacingNodeType(null)
          fin.setDesignTool('select')
        }

        const metrics = useMetricsStore.getState()
        metrics.clearMetrics()
        useLogStore.getState().clearLogs()
        metrics.restorePersistedWsEvents(persisted.deploymentId)
        if (row.status === 'running') {
          ensureClientLoadgenMetrics()
        }
      } catch {
        if (!cancelled) clearLiveSessionPersist()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
}
