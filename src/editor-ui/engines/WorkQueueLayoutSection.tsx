import { useMemo } from 'react'
import { useCanvasStore } from '../../editor-core/stores/canvasStore'
import { buildJobsPanelModel } from '../../lib/engines/jobsPanelModel'
import {
  applyEngineChangePreview,
  canShareWorkQueueRedis,
  previewWorkQueueRedis,
  type WorkQueueRedisMode,
} from '../../lib/engines/engineChangePreview'

/** Left-sidebar choice: one Redis for the queue, or a second Redis. */
export function WorkQueueLayoutSection() {
  const mode = useCanvasStore((s) => s.mode)
  const nodes = useCanvasStore((s) => s.nodes)
  const jobBindings = useCanvasStore((s) => s.jobBindings)
  const templateId = useCanvasStore((s) => s.snapshotTemplateId)
  const exportJSON = useCanvasStore((s) => s.exportJSON)

  const layout = useMemo(() => {
    if (mode !== 'design') return null
    const snap = exportJSON()
    if (!canShareWorkQueueRedis(snap)) return null
    const rows = buildJobsPanelModel(snap, null)
    const queue = rows.find((row) => row.jobId === 'work_queue')
    if (!queue?.allowedEngines.includes('redis')) return null
    const dataId = rows.find(
      (row) => row.jobId === 'timeline' || row.jobId === 'hot_cache',
    )?.nodeId
    const current: WorkQueueRedisMode | null =
      queue.engine === 'redis' && queue.nodeId && dataId
        ? queue.nodeId === dataId
          ? 'share'
          : 'separate'
        : null
    return { current }
  }, [mode, nodes, jobBindings, templateId, exportJSON])

  if (!layout) return null

  const apply = (next: WorkQueueRedisMode) => {
    const preview = previewWorkQueueRedis(exportJSON(), next)
    applyEngineChangePreview(preview, 'work_queue', useCanvasStore.getState())
  }

  return (
    <div>
      <h2 className="sl-lab mb-2 pt-2">Work queue</h2>
      <div className="btn-stack flex flex-col gap-1.5">
        <button
          type="button"
          className={`sl-btn w-full${layout.current === 'share' ? ' is-on' : ''}`}
          aria-pressed={layout.current === 'share'}
          onClick={() => apply('share')}
        >
          One Redis
        </button>
        <button
          type="button"
          className={`sl-btn w-full${layout.current === 'separate' ? ' is-on' : ''}`}
          aria-pressed={layout.current === 'separate'}
          onClick={() => apply('separate')}
        >
          Two Redis nodes
        </button>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-[var(--c9-muted)]">
        {layout.current === 'separate'
          ? 'The queue has its own Redis.'
          : layout.current === 'share'
            ? 'The queue shares the timeline Redis.'
            : 'Choose one Redis or a second Redis for the queue.'}
      </p>
    </div>
  )
}
