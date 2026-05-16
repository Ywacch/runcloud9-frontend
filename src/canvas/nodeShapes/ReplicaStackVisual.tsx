import { useMemo } from 'react'
import * as THREE from 'three'
import type { CanvasNode } from '../../store/canvasStore'
import { ProceduralNodeShape } from './ProceduralNodeShape'
import { darkenHex } from './shapeUtils'

interface ReplicaStackVisualProps {
  type: CanvasNode['type']
  face: string
  edgeColor: string
  darkenFactor: number
  /** Stacked replica count for this visual (usually 1 when exploded). */
  replicas?: number
  singleStackSlot?: number
  stackUnitUseLocalOrigin?: boolean
  mqPartitions?: number
}

export function ReplicaStackVisual({
  type,
  face,
  edgeColor,
  darkenFactor,
  replicas = 1,
  singleStackSlot,
  stackUnitUseLocalOrigin,
  mqPartitions,
}: ReplicaStackVisualProps) {
  const displayFace = useMemo(
    () => darkenHex(face, darkenFactor),
    [face, darkenFactor],
  )
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: displayFace,
        roughness: 0.8,
        metalness: 0,
      }),
    [displayFace],
  )

  return (
    <ProceduralNodeShape
      type={type}
      face={displayFace}
      edgeColor={edgeColor}
      bodyMaterial={material}
      replicas={replicas}
      singleStackSlot={singleStackSlot}
      mqPartitions={type === 'message_queue' ? mqPartitions : undefined}
      stackUnitUseLocalOrigin={stackUnitUseLocalOrigin}
    />
  )
}
