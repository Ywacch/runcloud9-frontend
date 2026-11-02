import { useEffect, useMemo, useState } from 'react'
import { useCanvasStore } from '../../editor-core/stores/canvasStore'
import { configPatchForEngine } from '../../svg-canvas/bridge/canvasSvgAdapter'
import { loadEnginesSession } from '../../lib/engines/enginesSession'
import {
  buildJobsPanelModel,
  type JobsPanelRow,
} from '../../lib/engines/jobsPanelModel'
import {
  applyEngineChangePreview,
  previewJobEngineChange,
} from '../../lib/engines/engineChangePreview'
import { templateHasJobsPanel } from '../../lib/engines/templateJobCatalog'
import { EnginePicker } from './EnginePicker'

type JobsPanelProps = {
  disabled?: boolean
}

export function JobsPanel({ disabled }: JobsPanelProps) {
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const nodes = useCanvasStore((s) => s.nodes)
  const jobBindings = useCanvasStore((s) => s.jobBindings)
  const exportJSON = useCanvasStore((s) => s.exportJSON)
  const setJobBinding = useCanvasStore((s) => s.setJobBinding)
  const removeNode = useCanvasStore((s) => s.removeNode)
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig)

  const [catalog, setCatalog] = useState<Awaited<
    ReturnType<typeof loadEnginesSession>
  > | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!templateHasJobsPanel(snapshotTemplateId)) return
    let cancelled = false
    void loadEnginesSession()
      .then((session) => {
        if (!cancelled) setCatalog(session)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load jobs catalog')
        }
      })
    return () => {
      cancelled = true
    }
  }, [snapshotTemplateId])

  const rows = useMemo(() => {
    if (!catalog || !templateHasJobsPanel(snapshotTemplateId)) return []
    return buildJobsPanelModel(exportJSON(), catalog.catalog)
  }, [catalog, snapshotTemplateId, nodes, jobBindings, exportJSON])

  if (!templateHasJobsPanel(snapshotTemplateId)) return null

  const applyEngine = (row: JobsPanelRow, engine: string) => {
    if (!row.allowedEngines.includes(engine)) return
    const preview = previewJobEngineChange(exportJSON(), row.jobId, engine)
    applyEngineChangePreview(preview, row.jobId, useCanvasStore.getState())
  }

  const bindNode = (row: JobsPanelRow, nodeId: string) => {
    if (!nodeId) {
      setJobBinding(row.jobId, null)
      return
    }
    const target = nodes[nodeId]
    if (row.jobId === 'work_queue' && target?.type === 'cache') {
      const preview = previewJobEngineChange(exportJSON(), 'work_queue', 'redis')
      setJobBinding(row.jobId, nodeId)
      updateNodeConfig(nodeId, configPatchForEngine('cache', 'redis'))
      for (const id of preview.removeNodeIds) {
        if (nodes[id]) removeNode(id)
      }
      return
    }
    setJobBinding(row.jobId, nodeId)
  }

  return (
    <section className="sl-jobs-panel" aria-label="Platform jobs">
      <h2 className="sl-lab mb-2 pt-2">Jobs</h2>
      {loadError ? (
        <p className="text-xs text-[var(--sl-red)]">{loadError}</p>
      ) : null}
      {!catalog ? (
        <p className="text-xs text-[var(--sl-ink-3)]">Loading job catalog…</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.jobId} className="sl-jobs-row">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-[var(--sl-ink)]">
                  {row.jobLabel}
                  {row.required ? (
                    <span className="text-[var(--sl-ink-3)]"> · required</span>
                  ) : null}
                </span>
              </div>
              <label className="mt-1 block text-[10px] uppercase tracking-wide text-[var(--sl-ink-3)]">
                Node
                <select
                  className="sl-jobs-select mt-0.5 w-full"
                  disabled={disabled || row.candidateNodeIds.length === 0}
                  value={row.nodeId ?? ''}
                  onChange={(e) => bindNode(row, e.target.value)}
                >
                  <option value="">Unbound</option>
                  {row.candidateNodeIds.map((id) => (
                    <option key={id} value={id}>
                      {nodes[id]?.label ?? id}
                    </option>
                  ))}
                </select>
              </label>
              {row.nodeId && catalog ? (
                <EnginePicker
                  jobId={row.jobId}
                  catalog={catalog.catalog}
                  gates={catalog.gates}
                  selectedEngine={row.engine}
                  allowedEngines={row.allowedEngines}
                  onSelectEngine={(engine) => applyEngine(row, engine)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
