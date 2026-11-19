import { useMemo } from 'react'
import { useTemplateFloorPreviewStore } from '../../editor-core/stores/templateFloorPreviewStore'
import { projectedSceneFromSnapshot } from '../bridge/isoPreviewScene'
import { useProjectionT } from '../store/projectionStore'
import { presentWorld } from '../math/projection'
import { NodeGlyph } from '../glyphs/NodeGlyph'
import { StaticConnectorShafts } from './StaticConnectorShafts'

/** Ghost topology from sidebar hover — does not mutate the placed canvas. */
export function TemplateFloorPreviewLayer() {
  const snapshot = useTemplateFloorPreviewStore((s) => s.snapshot)
  const projectionT = useProjectionT()

  const scene = useMemo(
    () => (snapshot ? projectedSceneFromSnapshot(snapshot) : null),
    [snapshot],
  )

  if (!scene || scene.nodes.length === 0) return null

  return (
    <g data-template-floor-preview style={{ pointerEvents: 'none' }} opacity={0.92}>
      <StaticConnectorShafts
        ghost
        edges={scene.edges.map((e) => ({
          ...e,
          waypoints: e.waypoints.map((p) => presentWorld(p, projectionT)),
        }))}
      />
      {scene.nodes.map((node) => {
        const at = presentWorld({ x: node.x, y: node.y }, projectionT)
        return (
          <NodeGlyph
            key={`preview:${node.id}`}
            node={node}
            x={at.x}
            y={at.y}
            interactive={false}
            frozen
            projectionT={projectionT}
          />
        )
      })}
    </g>
  )
}

export function templatePreviewDimOpacity(active: boolean, reducedMotion: boolean): number {
  if (!active) return 1
  return reducedMotion ? 0.42 : 0.38
}