import { type ThreeEvent, useThree } from '@react-three/fiber'
import { type RefObject } from 'react'
import * as THREE from 'three'
import { createCanvasNode } from '../lib/nodeFactory'
import { isCanvasEditMode, useCanvasStore } from '../store/canvasStore'

export interface GridFloorProps {
  planeRef: RefObject<THREE.Mesh | null>
}

export function GridFloor({ planeRef }: GridFloorProps) {
  const placingNodeType = useCanvasStore((s) => s.placingNodeType)
  const addNode = useCanvasStore((s) => s.addNode)
  const selectNode = useCanvasStore((s) => s.selectNode)
  const setPlacingNodeType = useCanvasStore((s) => s.setPlacingNodeType)
  const { invalidate } = useThree()

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return

    const store = useCanvasStore.getState()

    if (placingNodeType) {
      e.stopPropagation()
      const x = Math.round(e.point.x)
      const z = Math.round(e.point.z)
      const node = createCanvasNode(placingNodeType, [x, 0.3, z], store.nodes)
      addNode(node)
      selectNode(node.id)
      setPlacingNodeType(null)
      invalidate()
      return
    }

    if (isCanvasEditMode(store.mode)) {
      if (store.pendingSourceId) {
        store.setPendingSource(null)
      }
      store.selectNode(null)
    }
  }

  return (
    <>
      <gridHelper args={[100, 100, '#cccccc', '#e5e5e5']} position={[0, 0, 0]} />
      <mesh
        ref={planeRef}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handlePointerDown}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  )
}
