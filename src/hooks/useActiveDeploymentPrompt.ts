import { useEffect, useState } from 'react'
import { getDeployment, listActiveDeployments, type ActiveDeploymentSummary } from '../lib/api'
import { deploymentDesignToSnapshot } from '../lib/deployPayload'
import { persistLiveSession, readLiveSessionPersist } from '../lib/liveSessionStorage'
import {
  ensureClientLoadgenMetrics,
  spawnClientLoadgenNode,
} from '../lib/spawnClientNode'
import { useCanvasStore } from '../store/canvasStore'
import { useLogStore } from '../store/logStore'
import { useMetricsStore } from '../store/metricsStore'

interface ActivePromptState {
  deploymentId: string
  templateId: string
  expiresAt: string
}

export function useActiveDeploymentPrompt(): {
  prompt: ActivePromptState | null
  rejoin: () => Promise<void>
  dismiss: () => void
} {
  const [prompt, setPrompt] = useState<ActivePromptState | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // Session restore handles reconnect when we already have a snapshot in storage.
        if (readLiveSessionPersist()) return

        const list = await listActiveDeployments()
        if (cancelled || !list.length) return
        // For now pick the most recent by createdAt.
        const sorted = [...list].sort(
          (a: ActiveDeploymentSummary, b: ActiveDeploymentSummary) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        const top = sorted[0]
        setPrompt({
          deploymentId: top.namespace || top.id,
          templateId: top.template,
          expiresAt: top.expiresAt,
        })
      } catch {
        // Ignore errors — no banner if listing fails.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = () => setPrompt(null)

  const rejoin = async () => {
    if (!prompt) return
    const id = prompt.deploymentId
    try {
      const row: any = await getDeployment(id)
      if (!row || !row.design) {
        setPrompt(null)
        return
      }

      const snapshot = deploymentDesignToSnapshot(
        row.design,
        row.template || prompt.templateId,
      )

      persistLiveSession(id, snapshot)

      const st = useCanvasStore.getState()
      st.loadJSON(snapshot)
      st.setDeploymentId(id)
      const expiresMs = Date.parse(row.expiresAt || prompt.expiresAt)
      st.setLiveSessionEndsAt(
        Number.isFinite(expiresMs) ? expiresMs : Date.now() + 9 * 60 * 1000,
      )

      const fin = useCanvasStore.getState()
      if (row.status === 'running') {
        fin.setAllEdgesAnimated(true)
        Object.keys(fin.nodes).forEach((nid) => {
          const n = fin.nodes[nid]
          if (!n || n.type === 'client') return
          fin.updateNodeStatus(nid, 'healthy')
        })
        fin.setMode('live')
        spawnClientLoadgenNode()
        ensureClientLoadgenMetrics()
      } else if (row.status === 'provisioning') {
        fin.setAllEdgesAnimated(false)
        Object.keys(fin.nodes).forEach((nid) => {
          const n = fin.nodes[nid]
          if (!n || n.type === 'client') return
          fin.updateNodeStatus(nid, 'provisioning')
        })
        fin.setMode('design')
      } else {
        setPrompt(null)
        return
      }
      fin.selectNode(null)
      fin.setPendingSource(null)
      fin.setPlacingNodeType(null)
      fin.setDesignTool('select')

      const metrics = useMetricsStore.getState()
      metrics.clearMetrics()
      useLogStore.getState().clearLogs()
      metrics.restorePersistedWsEvents(id)

      setPrompt(null)
    } catch {
      setPrompt(null)
    }
  }

  return { prompt, rejoin, dismiss }
}

