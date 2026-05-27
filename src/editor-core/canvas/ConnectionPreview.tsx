import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { manhattanWaypoints } from '../../lib/manhattan'
import { isCanvasEditMode, useCanvasStore } from '../stores/canvasStore'

/** Dashed preview while a connection source is armed and another node is hovered. */
export function ConnectionPreview() {
  const mode = useCanvasStore((s) => s.mode)
  const designTool = useCanvasStore((s) => s.designTool)
  const pendingSourceId = useCanvasStore((s) => s.pendingSourceId)
  const hoverId = useCanvasStore((s) => s.connectHoverTargetId)
  const nodes = useCanvasStore((s) => s.nodes)

  const points = useMemo(() => {
    if (
      !isCanvasEditMode(mode) ||
      designTool !== 'connect' ||
      !pendingSourceId ||
      !hoverId ||
      pendingSourceId === hoverId
    ) {
      return null
    }
    const a = nodes[pendingSourceId]
    const b = nodes[hoverId]
    if (!a || !b) return null
    const wp = manhattanWaypoints(a.position, b.position)
    return wp.map(([x, y, z]) => new THREE.Vector3(x, y, z))
  }, [mode, designTool, pendingSourceId, hoverId, nodes])

  if (!points || points.length < 2) return null

  return (
    <Line
      points={points}
      color="#4A90D9"
      lineWidth={1}
      dashed
      dashSize={0.12}
      gapSize={0.08}
      transparent
      opacity={0.35}
    />
  )
}
