import type { useDrag } from '@use-gesture/react'
import { forwardRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { CanvasNode } from '../../stores/canvasStore'
import { getNodeUnitSpec, getStackHeight } from './nodeBounds'
import { ProceduralNodeShape } from './ProceduralNodeShape'

export interface NodeColliderProps {
  type: CanvasNode['type']
  face: string
  edgeColor: string
  bodyMaterial: THREE.MeshStandardMaterial
  /** Number of vertically-stacked units; defaults to 1 (no replicas). */
  replicas?: number
  mqPartitions?: number
  singleStackSlot?: number
  stackUnitUseLocalOrigin?: boolean
  dragBind?: ReturnType<typeof useDrag>
  movementLocked?: boolean
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void
  onClick?: (e: { stopPropagation: () => void }) => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  onPointerOver?: () => void
  onPointerOut?: () => void
}

export const NodeCollider = forwardRef<THREE.Mesh, NodeColliderProps>(
  function NodeCollider(
    {
      type,
      face,
      edgeColor,
      bodyMaterial,
      replicas = 1,
      mqPartitions = 1,
      singleStackSlot,
      stackUnitUseLocalOrigin = false,
      dragBind,
      movementLocked,
      onPointerDown,
      onClick,
      onPointerEnter,
      onPointerLeave,
      onPointerOver,
      onPointerOut,
    },
    ref,
  ) {
    const spec = getNodeUnitSpec(type)
    const count = Math.max(1, Math.floor(replicas))
    const stackH = getStackHeight(spec, count)
    const useExplodedOrigin =
      Boolean(stackUnitUseLocalOrigin) &&
      count === 1 &&
      singleStackSlot != null
    const colliderCenterY = useExplodedOrigin ? 0 : spec.baseY + stackH / 2

    return (
      <group>
        <ProceduralNodeShape
          type={type}
          face={face}
          edgeColor={edgeColor}
          bodyMaterial={bodyMaterial}
          replicas={count}
          singleStackSlot={singleStackSlot}
          mqPartitions={mqPartitions}
          stackUnitUseLocalOrigin={stackUnitUseLocalOrigin}
        />
        <mesh
          ref={ref}
          visible={false}
          position={[0, colliderCenterY, 0]}
          material={bodyMaterial}
          {...dragBind}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            if (e.button === 0) e.stopPropagation()
            if (!movementLocked) {
              dragBind?.onPointerDown?.(
                e as unknown as ReactPointerEvent<HTMLElement>,
              )
            }
            onPointerDown?.(e)
          }}
          onClick={onClick}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        >
          <boxGeometry args={[spec.w, stackH, spec.d]} />
        </mesh>
      </group>
    )
  },
)
