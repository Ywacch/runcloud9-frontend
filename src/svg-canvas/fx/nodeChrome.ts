import type { HealthState } from '../../editor-core/domain/healthThresholds'
import type { CanvasMode, CanvasNode } from '../../editor-core/stores/canvasStore'
import { formatProvisionedShort, resolveProvisionedLimits } from '../../lib/resolveProvisionedLimits'
import { getResourceProfilesCached } from '../../lib/resourceProfileStore'
import type { SvgNode } from '../store/svgTypes'
import { walkthroughGlyphArtBox } from '../fx/walkthroughChrome'

export function shouldShowProvisionedSublabel(mode: CanvasMode): boolean {
  return mode === 'design' || mode === 'simulate'
}

export function provisionedSublabelForNode(node: CanvasNode): string | null {
  if (node.type === 'client') return null
  const catalog = getResourceProfilesCached()
  return formatProvisionedShort(
    resolveProvisionedLimits(node.type, node.config, catalog),
  )
}

/** Observe palette: warning names are amber, error names are red, replica count is teal. */
export const NODE_LABEL_DEFAULT = '#ffffff'
export const NODE_LABEL_WARN = '#e0a64b'
export const NODE_LABEL_ERROR = '#e0405c'
export const REPLICA_BADGE_FILL = '#7fcdb9'

export function nodeLabelFill(health: HealthState): string {
  if (health === 'warning') return NODE_LABEL_WARN
  if (health === 'error') return NODE_LABEL_ERROR
  return NODE_LABEL_DEFAULT
}

/** Match Pixi replica badge copy (`×N` / `+N read`). */
export function replicaBadgeText(node: SvgNode): string | null {
  if (node.archetype === 'load-balancer' || node.archetype === 'client') {
    return null
  }
  const layers = Math.max(1, node.topology.replicas)
  if (layers <= 1) return null
  if (node.archetype === 'database') {
    return `+${layers - 1} read`
  }
  return `×${layers}`
}

export function statusDotColor(
  status: CanvasNode['status'] | undefined,
): string {
  switch (status) {
    case 'healthy':
      return '#22c55e'
    case 'provisioning':
      return '#fbbf24'
    case 'degraded':
      return '#ef4444'
    default:
      return '#475569'
  }
}

/** Label / badge / status anchors in SVG world space (tip-local art box). */
export function nodeChromeAnchors(node: SvgNode): {
  labelX: number
  labelY: number
  sublabelY: number
  statusX: number
  statusY: number
} {
  const box = walkthroughGlyphArtBox(node, 0)
  const cx = box.x + box.w / 2
  return {
    labelX: cx,
    labelY: box.y - 6,
    sublabelY: box.y + 2,
    statusX: box.x + box.w + 4,
    statusY: box.y + Math.min(24, box.h * 0.28),
  }
}
