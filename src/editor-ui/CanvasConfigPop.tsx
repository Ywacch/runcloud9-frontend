import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { snapshotToDeploymentDesign } from '../lib/deployPayload'
import { parseCpuMilli, parseMemoryBytes } from '../lib/k8sQuantity'
import {
  designExceedsResourceQuota,
  sumDesignBudget,
} from '../lib/sumDesignBudget'
import { quotaTierFromAuth } from '../lib/userTier'
import { useAuthStore } from '../product/stores/authStore'
import { canvasPositionToSvgWorld } from '../svg-canvas/bridge/canvasSvgAdapter'
import { useSvgCanvasStore } from '../svg-canvas/store/svgCanvasStore'
import {
  subscribeSvgViewportScreenRefresh,
  svgWorldToHost,
} from '../svg-canvas/utils/svgViewportBridge'
import { commitCanvasDesignConfig } from '../lib/canvasDesignConfigCommit'
import {
  maxAppServerReplicasForUser,
  maxInstanceSizeForUser,
  resolveEffectiveTier,
} from '../lib/userTier'
import { CanvasDesignFields } from './CanvasDesignFields'

const POP_TAG: Record<string, string> = {
  compute: 'App server',
  database: 'PostgreSQL',
  cache: 'Redis',
  worker: 'Worker',
  message_queue: 'RabbitMQ',
  load_balancer: 'Load balancer',
  client: 'Traffic Source',
}

const POP_W = 240
const GAP = 26
const FLOOR_TOOL_CLEARANCE = 60

function useDesignBudgetFooter() {
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const exportJSON = useCanvasStore((s) => s.exportJSON)
  const currentUser = useAuthStore((s) => s.currentUser)
  const userRecord = useAuthStore((s) => s.userRecord)
  const session = useAuthStore((s) => s.session)
  const quotaTier = quotaTierFromAuth(currentUser, userRecord, Boolean(session))

  return useMemo(() => {
    if (!snapshotTemplateId || !quotaTier) return null
    try {
      const design = snapshotToDeploymentDesign(exportJSON(), { mutateCanvas: false })
      const summary = sumDesignBudget(design, quotaTier)
      const over = designExceedsResourceQuota(design, quotaTier)
      const capCpu = parseCpuMilli(summary.cap.cpu)
      const capMem = parseMemoryBytes(summary.cap.memory)
      const fill = Math.min(
        100,
        Math.round(
          Math.max(summary.cpuMilli / capCpu, summary.memoryBytes / capMem) * 100,
        ),
      )
      return {
        over: Boolean(over),
        fill,
        requested: summary.requested,
        cap: summary.cap,
      }
    } catch {
      return null
    }
  }, [exportJSON, quotaTier, snapshotTemplateId])
}

function popPosition(
  anchorX: number,
  anchorY: number,
  hostW: number,
  hostH: number,
  popH: number,
): { left: number; top: number } {
  let left = anchorX + 80
  if (left + POP_W > hostW - 12) {
    left = anchorX - GAP - POP_W
  }
  left = Math.max(12, Math.min(left, hostW - POP_W - 12))
  const top = Math.max(
    12,
    Math.min(anchorY - 20, hostH - popH - FLOOR_TOOL_CLEARANCE),
  )
  return { left, top }
}

/**
 * runcloud9-ui canvas.html #pop — design config beside the selected node.
 */
export function CanvasConfigPop({ hostRef }: { hostRef: React.RefObject<HTMLElement | null> }) {
  const mode = useCanvasStore((s) => s.mode)
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const selectedId = useCanvasStore((s) => s.selectedId)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const loadedVariationId = useCanvasStore((s) => s.loadedVariationId)
  const selectNode = useCanvasStore((s) => s.selectNode)
  const currentUser = useAuthStore((s) => s.currentUser)
  const userRecord = useAuthStore((s) => s.userRecord)

  const nodeId = selectedIds.length === 1 ? selectedIds[0] : selectedId
  const node = nodeId ? nodes[nodeId] ?? null : null
  const svgNode = useSvgCanvasStore((s) =>
    nodeId ? s.nodes.find((n) => n.id === nodeId) : undefined,
  )

  const popRef = useRef<HTMLElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const budget = useDesignBudgetFooter()

  const designLimits = useMemo(() => {
    const maxAppReplicas =
      currentUser?.limits.maxAppServerReplicas ??
      maxAppServerReplicasForUser(userRecord)
    const maxInstanceSize = maxInstanceSizeForUser(
      userRecord,
      currentUser?.limits,
    )
    const allowAutoscale =
      currentUser?.limits.allowAutoscale === true ||
      currentUser?.isInternal === true ||
      resolveEffectiveTier(userRecord) === 'internal'
    return { maxAppReplicas, maxInstanceSize, allowAutoscale }
  }, [currentUser, userRecord])

  const commitConfig = useCallback(
    (patch: Parameters<typeof commitCanvasDesignConfig>[1]) => {
      if (!nodeId) return
      commitCanvasDesignConfig(nodeId, patch, {
        maxAppReplicas: designLimits.maxAppReplicas,
      })
    },
    [designLimits.maxAppReplicas, nodeId],
  )

  const active =
    mode === 'design' && !deploymentId && node != null && Object.keys(nodes).length > 0

  const relayout = useCallback(() => {
    if (!active || !node || !hostRef.current || !popRef.current) {
      setPos(null)
      return
    }
    const world = svgNode
      ? { x: svgNode.x, y: svgNode.y }
      : canvasPositionToSvgWorld(node.position)
    const anchor = svgWorldToHost(world.x, world.y)
    if (!anchor) {
      setPos(null)
      return
    }
    const host = hostRef.current.getBoundingClientRect()
    const popH = popRef.current.offsetHeight || 320
    setPos(popPosition(anchor.x, anchor.y, host.width, host.height, popH))
  }, [active, hostRef, node, svgNode?.x, svgNode?.y])

  useLayoutEffect(() => {
    relayout()
  }, [relayout, node?.id, node?.position])

  useEffect(() => {
    if (!active) return
    return subscribeSvgViewportScreenRefresh(relayout)
  }, [active, relayout])

  useEffect(() => {
    if (!active || !popRef.current) return
    popRef.current.focus({ preventScroll: true })
  }, [active, node?.id])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        selectNode(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active, selectNode])

  if (!active || !node) return null

  const tag = POP_TAG[node.type] ?? ''
  const showTag = tag.toLowerCase() !== node.label.trim().toLowerCase()

  return (
    <section
      ref={popRef}
      className="cv-pop pointer-events-auto"
      role="dialog"
      aria-labelledby="pop-name"
      tabIndex={-1}
      style={
        pos
          ? { left: pos.left, top: pos.top, width: POP_W }
          : { left: -9999, top: 12, width: POP_W, visibility: 'hidden' as const }
      }
    >
      <header className="cv-pop-hd">
        <h2 id="pop-name">{node.label}</h2>
        {showTag ? <span className="cv-tag">{tag}</span> : <span className="cv-tag" />}
        <button
          type="button"
          className="cv-x"
          aria-label="Close settings"
          onClick={() => selectNode(null)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6 6l12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>
      <div className="cv-pop-b">
        <CanvasDesignFields
          node={node}
          edges={edges}
          nodes={nodes}
          loadedVariationId={loadedVariationId}
          limits={designLimits}
          updateConfig={commitConfig}
        />
      </div>
      {budget ? (
        <footer className={`cv-pop-ft${budget.over ? ' is-over' : ''}`}>
          <div className="cv-bud">
            <span>{budget.over ? 'Over budget' : 'Budget'}</span>
            <span className="cv-bud-v">
              {budget.requested.cpu} / {budget.cap.cpu} CPU · {budget.requested.memory} /{' '}
              {budget.cap.memory}
            </span>
          </div>
          <i className="cv-bud-bar" aria-hidden>
            <b style={{ width: `${budget.fill}%` }} />
          </i>
        </footer>
      ) : null}
    </section>
  )
}