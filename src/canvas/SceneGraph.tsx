import { BaseNode } from './BaseNode'
import { ConnectionLine } from './ConnectionLine'
import { ConnectionPreview } from './ConnectionPreview'
import { useCanvasStore } from '../store/canvasStore'

export function SceneGraph() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)

  return (
    <>
      {Object.values(edges).map((edge) => (
        <ConnectionLine key={edge.id} edge={edge} />
      ))}
      <ConnectionPreview />
      {Object.values(nodes).map((node) => (
        <BaseNode key={node.id} node={node} />
      ))}
    </>
  )
}
