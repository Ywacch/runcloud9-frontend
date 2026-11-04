import { useEffect, useMemo } from 'react'
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

  return <WorkQueueLayoutButtons current={layout.current} />
}

function WorkQueueLayoutButtons({
  current,
}: {
  current: WorkQueueRedisMode | null
}) {
  const nodes = useCanvasStore((s) => s.nodes)
  const exportJSON = useCanvasStore((s) => s.exportJSON)
  const cacheCount = Object.values(nodes).filter((node) => node.type === 'cache').length

  useEffect(() => {
    if (current !== 'share' || cacheCount < 2) return
    const preview = previewWorkQueueRedis(exportJSON(), 'share')
    if (!preview.removeNodeIds.some((id) => nodes[id]?.type === 'cache')) return
    applyEngineChangePreview(preview, 'work_queue', useCanvasStore.getState())
  }, [current, cacheCount, nodes, exportJSON])

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
          className={`sl-btn w-full${current === 'share' ? ' is-on' : ''}`}
          aria-pressed={current === 'share'}
          onClick={() => apply('share')}
        >
          One Redis
        </button>
        <button
          type="button"
          className={`sl-btn w-full${current === 'separate' ? ' is-on' : ''}`}
          aria-pressed={current === 'separate'}
          onClick={() => apply('separate')}
        >
          Two Redis nodes
        </button>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-[var(--c9-muted)]">
        {current === 'separate'
          ? 'The queue has its own Redis.'
          : current === 'share'
            ? 'The queue shares the timeline Redis.'
            : 'Choose one Redis or a second Redis for the queue.'}
      </p>
    </div>
  )
}
