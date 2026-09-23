import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import {
  metricGroupsForNode,
  type InspectorMetricGroupId,
} from '../lib/inspectorMetricGroups'

export function InspectorBreadcrumbNav({
  node,
  m,
  activeGroupId,
  onSelectGroup,
  title,
}: {
  node: CanvasNode
  m?: MetricsBucket
  activeGroupId: InspectorMetricGroupId
  onSelectGroup: (id: InspectorMetricGroupId) => void
  title?: string
}) {
  const groups = metricGroupsForNode(node, m)
  if (groups.length === 0) return null

  return (
    <nav className="crumbs" aria-label="Metric groups" data-crumbs>
      {title ? <span className="crumb-lead">{title}</span> : null}
      {groups.map((group) => (
        <span key={group.id} style={{ display: 'contents' }}>
          <span className="crumb-sep">/</span>
          <button
            type="button"
            onClick={() => onSelectGroup(group.id)}
            aria-current={activeGroupId === group.id ? 'page' : undefined}
            className={`crumb ${activeGroupId === group.id ? 'is-on' : 'dimmed'}`}
          >
            <span className="sq" />
            {group.label}
          </button>
        </span>
      ))}
    </nav>
  )
}
