import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import {
  defaultMetricGroupId,
  type InspectorMetricGroupId,
} from '../lib/inspectorMetricGroups'
import type { SelectedInstanceId } from '../lib/dbInstanceScope'
import type { ReplicaInspectorRow } from '../lib/replicaMetricsDisplay'
import type { PanelViewState } from './inspectorPanelUi'
import { StacklabInspectorPane } from './stacklabInspectorPanes'

export function LiveMetricsTypeSection({
  node,
  m,
  history,
  edges,
  nodes,
  snapshotTemplateId,
  templateMetrics,
  view,
  onPanelViewChange,
  selectedInstanceId = null,
  metricGroup,
  onSelectMetricGroup,
  onOpenDataTab,
  showLatencyControls = true,
}: {
  node: CanvasNode
  m: MetricsBucket
  mode: string
  history: MetricsBucket[]
  edges: Record<string, CanvasEdge>
  nodes: Record<string, CanvasNode>
  snapshotTemplateId: string | null
  templateMetrics: Record<string, number>
  loadgenActive: boolean
  view: PanelViewState
  onPanelViewChange?: (patch: Partial<PanelViewState>) => void
  replicaRows?: ReplicaInspectorRow[]
  selectedInstanceId?: SelectedInstanceId
  metricsPreviewActive?: boolean
  metricGroup?: InspectorMetricGroupId
  onSelectMetricGroup?: (id: InspectorMetricGroupId) => void
  onOpenDataTab?: () => void
  showLatencyControls?: boolean
}) {
  const setSelectedInstanceId = useCanvasStore((s) => s.setSelectedInstanceId)
  const groupId = metricGroup ?? defaultMetricGroupId(node)

  return (
    <StacklabInspectorPane
      node={node}
      m={m}
      history={history}
      nodes={nodes}
      edges={edges}
      snapshotTemplateId={snapshotTemplateId}
      templateMetrics={templateMetrics}
      view={view}
      metricGroup={groupId}
      selectedInstanceId={selectedInstanceId}
      onPanelViewChange={onPanelViewChange}
      onSelectPod={setSelectedInstanceId}
      onSelectMetricGroup={onSelectMetricGroup}
      onOpenDataTab={onOpenDataTab}
      showLatencyControls={showLatencyControls}
    />
  )
}
