import type { CanvasSnapshot } from '../../editor-core/stores/canvasStore'
import {
  previewWorldPoints,
  projectedSceneFromSnapshot,
} from '../bridge/isoPreviewScene'
import {
  topologyPreviewViewBox,
  viewBoxAttr,
} from '../export/exportViewBox'
import { FLOOR_THEMES } from '../theme/floorTheme'
import { Floor } from './Floor'
import { GridPatterns } from './GridPatterns'
import { NodeGlyph } from '../glyphs/NodeGlyph'
import { StaticConnectorShafts } from './StaticConnectorShafts'

type Props = {
  snapshot: CanvasSnapshot
  className?: string
}

/** Isometric canvas thumb from a static snapshot (glyphs + 8-axis shafts + bounded floor). */
export function IsoTopologyPreview({ snapshot, className = 'h-full w-full' }: Props) {
  if (snapshot.nodes.length === 0) return null

  const scene = projectedSceneFromSnapshot(snapshot)
  const vb = topologyPreviewViewBox(previewWorldPoints(scene))
  const theme = FLOOR_THEMES.dark

  return (
    <svg
      viewBox={viewBoxAttr(vb)}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden
    >
      <GridPatterns theme={theme} />
      <Floor
        mode="bounded"
        theme={theme}
        viewX={vb.x}
        viewY={vb.y}
        viewW={vb.w}
        viewH={vb.h}
      />
      <StaticConnectorShafts edges={scene.edges} />
      <g data-node-glyphs>
        {scene.nodes.map((node) => (
            <NodeGlyph
            key={node.id}
            node={node}
            x={node.x}
            y={node.y}
            interactive={false}
            frozen
          />
        ))}
      </g>
    </svg>
  )
}
