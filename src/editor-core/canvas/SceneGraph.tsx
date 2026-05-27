import { useMemo } from 'react'
import { getCacheTopologyEdgeIssues } from '../../lib/cacheTopologyStrategy'
import { BaseNode } from './BaseNode'
import { ConnectionLine } from './ConnectionLine'
import { ConnectionPreview } from './ConnectionPreview'
import { useCanvasStore } from '../stores/canvasStore'

export function SceneGraph() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)

  const topologyEdgeIssues = useMemo(
    () => getCacheTopologyEdgeIssues(nodes, edges),
    [nodes, edges],
  )

  return (
    <>
      {Object.values(edges).map((edge) => (
        <ConnectionLine
          key={edge.id}
          edge={edge}
          topologyIssue={topologyEdgeIssues[edge.id]}
        />
      ))}
      <ConnectionPreview />
      {Object.values(nodes).map((node) => (
        <BaseNode key={node.id} node={node} />
      ))}
    </>
  )
}
