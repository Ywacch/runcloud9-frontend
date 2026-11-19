import { useMemo } from 'react'
import { useTemplateFloorPreviewStore } from '../../editor-core/stores/templateFloorPreviewStore'
import type { CanvasSnapshot } from '../../editor-core/stores/canvasStore'
import { projectedSceneFromSnapshot } from '../bridge/isoPreviewScene'
import { useProjectionT } from '../store/projectionStore'
import { presentWorld } from '../math/projection'
import { NodeGlyph } from '../glyphs/NodeGlyph'
import { StaticConnectorShafts } from './StaticConnectorShafts'

const PREVIEW_ID = 'preview:'

function isolatePreviewSnapshot(snapshot: CanvasSnapshot): CanvasSnapshot {
  return {
    ...snapshot,
    nodes: snapshot.nodes.map((n) => ({ ...n, id: PREVIEW_ID + n.id })),
    edges: snapshot.edges.map((e) => ({
      ...e,
      id: PREVIEW_ID + e.id,
      sourceId: PREVIEW_ID + e.sourceId,
      targetId: PREVIEW_ID + e.targetId,
    })),
  }
}

/** Ghost topology from sidebar hover — same camera as the floor, does not mutate the placed canvas. */
export function TemplateFloorPreviewLayer() {
  const snapshot = useTemplateFloorPreviewStore((s) => s.snapshot)
  const projectionT = useProjectionT()

  const scene = useMemo(
    () => (snapshot ? projectedSceneFromSnapshot(isolatePreviewSnapshot(snapshot)) : null),
    [snapshot],
  )

  if (!scene || scene.nodes.length === 0) return null

  return (
    <g data-template-floor-preview style={{ pointerEvents: 'none' }}>
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
          <g
            key={node.id}
            opacity={0.45}
            style={{ filter: 'grayscale(0.85)' }}
          >
            <NodeGlyph
              node={node}
              x={at.x}
              y={at.y}
              interactive={false}
              frozen
              projectionT={projectionT}
            />
          </g>
        )
      })}
    </g>
  )
}

export function templatePreviewDimOpacity(active: boolean, reducedMotion: boolean): number {
  if (!active) return 1
  return reducedMotion ? 0.42 : 0.38
}
