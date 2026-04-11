import { Edges, Html } from '@react-three/drei'
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useDrag } from '@use-gesture/react'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { NODE_VISUAL } from '../lib/nodeVisual'
import {
  isCanvasEditMode,
  useCanvasStore,
  type CanvasNode,
} from '../store/canvasStore'
import { useMetricsStore } from '../store/metricsStore'
import { StatusBadge } from '../ui/StatusBadge'

const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

function PendingSourceRing() {
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock, invalidate: inv }) => {
    const m = matRef.current
    if (!m) return
    m.opacity = 0.42 + Math.sin(clock.elapsedTime * 3) * 0.28
    inv()
  })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <ringGeometry args={[0.82, 0.98, 48]} />
      <meshBasicMaterial
        ref={matRef}
        color="#4A90D9"
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </mesh>
  )
}

interface BaseNodeProps {
  node: CanvasNode
}

export function BaseNode({ node }: BaseNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const mode = useCanvasStore((s) => s.mode)
  const designTool = useCanvasStore((s) => s.designTool)
  const selectedId = useCanvasStore((s) => s.selectedId)
  const pendingSourceId = useCanvasStore((s) => s.pendingSourceId)
  const updateNodePosition = useCanvasStore((s) => s.updateNodePosition)
  const setConnectHoverTargetId = useCanvasStore((s) => s.setConnectHoverTargetId)

  const { camera, gl, invalidate: inv } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  const selected = selectedId === node.id
  const isPendingSource =
    pendingSourceId === node.id &&
    isCanvasEditMode(mode) &&
    designTool === 'connect'
  const isClient = node.type === 'client'
  const { face, edge } = NODE_VISUAL[node.type]
  const edgeColor = selected ? '#FFD700' : edge

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const mat = mesh.material as THREE.MeshStandardMaterial
    const st = useCanvasStore.getState()
    if (st.mode !== 'live') {
      mat.emissive.set('#000000')
      mat.emissiveIntensity = 0
      return
    }
    const n = st.nodes[node.id]
    if (!n) return
    if (n.type === 'client') {
      const loadgenOn = useMetricsStore.getState().loadgen?.active
      if (loadgenOn) {
        mat.emissive.set('#F5B041')
        mat.emissiveIntensity = 0.38 + Math.sin(Date.now() * 0.004) * 0.1
      } else {
        mat.emissive.set('#D68910')
        mat.emissiveIntensity = 0.14
      }
      /* Canvas uses frameloop="always"; skip invalidate to avoid Html+z-index churn when inspector opens. */
      return
    }
    if (n.status === 'healthy') {
      mat.emissive.set('#27AE60')
      mat.emissiveIntensity = 0.3
    } else if (n.status === 'degraded') {
      mat.emissive.set('#E74C3C')
      mat.emissiveIntensity = 0.3 + Math.sin(Date.now() * 0.012) * 0.2
    } else if (n.status === 'provisioning') {
      mat.emissive.set('#F0A500')
      mat.emissiveIntensity = 0.2 + Math.sin(Date.now() * 0.003) * 0.15
    } else {
      mat.emissive.set('#000000')
      mat.emissiveIntensity = 0
    }
    inv()
  })

  const bind = useDrag(
    ({ xy: [cx, cy], dragging, buttons }) => {
      if (isClient) return
      if (!isCanvasEditMode(mode) || designTool !== 'select' || !dragging) return
      if (buttons != null && buttons !== 1) return

      const rect = gl.domElement.getBoundingClientRect()
      const ndcX = ((cx - rect.left) / rect.width) * 2 - 1
      const ndcY = -((cy - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
      const hit = new THREE.Vector3()
      if (!raycaster.ray.intersectPlane(dragPlane, hit)) return

      const snapped: [number, number, number] = [
        Math.round(hit.x),
        0.3,
        Math.round(hit.z),
      ]
      updateNodePosition(node.id, snapped)
      inv()
    },
    { filterTaps: true, pointer: { capture: true } }
  )

  const dragBind =
    isCanvasEditMode(mode) && designTool === 'select' ? bind() : {}

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    if (mode === 'live') {
      useCanvasStore.getState().selectNode(node.id)
      return
    }
    if (!isCanvasEditMode(mode)) return

    const s = useCanvasStore.getState()
    const tool = s.designTool

    if (tool === 'erase') {
      if (!isClient) s.removeNode(node.id)
      return
    }

    if (tool === 'select') {
      s.setPendingSource(null)
      s.selectNode(node.id)
      return
    }

    // connect
    const pending = s.pendingSourceId
    if (pending === null) {
      s.setPendingSource(node.id)
      s.selectNode(node.id)
      return
    }
    if (pending === node.id) {
      s.setPendingSource(null)
      return
    }
    s.addEdge({
      id: crypto.randomUUID(),
      sourceId: pending,
      targetId: node.id,
      protocol: 'http',
      animated: false,
    })
    s.setPendingSource(null)
    s.selectNode(node.id)
  }

  return (
    <group position={node.position}>
      {isPendingSource ? <PendingSourceRing /> : null}
      <mesh
        ref={meshRef}
        {...dragBind}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          // R3F emits pointerdown to every hit along the ray; the floor behind the node would clear
          // pending connect + selection unless we stopPropagation here.
          if (isCanvasEditMode(mode) && e.button === 0) e.stopPropagation()
          // use-gesture is typed for React DOM PointerEvent; R3F's ThreeEvent is compatible for drag math.
          dragBind.onPointerDown?.(e as unknown as ReactPointerEvent<HTMLElement>)
        }}
        onClick={handleClick}
        onPointerOver={() => {
          if (!isCanvasEditMode(mode) || designTool !== 'connect') return
          const pending = useCanvasStore.getState().pendingSourceId
          if (pending && pending !== node.id) {
            setConnectHoverTargetId(node.id)
          }
        }}
        onPointerOut={() => {
          if (useCanvasStore.getState().connectHoverTargetId === node.id) {
            setConnectHoverTargetId(null)
          }
        }}
      >
        <boxGeometry args={isClient ? [1.0, 0.4, 1.0] : [1.4, 0.6, 1.4]} />
        <meshStandardMaterial color={face} />
        <Edges threshold={15} color={edgeColor} />
      </mesh>
      <Html position={[0, 0.6, 0]} center zIndexRange={[20, 10]}>
        <div
          className="rounded-full bg-white px-1.5 py-0.5 font-sans text-gray-900 shadow"
          style={{
            fontSize: 11,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {node.label}
        </div>
      </Html>
      {mode === 'live' ? <StatusBadge nodeId={node.id} /> : null}
    </group>
  )
}
