import { Edges, Html, Line } from '@react-three/drei'
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useDrag } from '@use-gesture/react'
import * as THREE from 'three'
import { defaultEdgeProtocol } from '../lib/defaultEdgeProtocol'
import { computeHealthState } from '../lib/healthThresholds'
import { NODE_VISUAL } from '../lib/nodeVisual'
import {
  isCanvasEditMode,
  isMetricsViewportMode,
  useCanvasStore,
  type CanvasNode,
} from '../store/canvasStore'
import { useMetricsStore } from '../store/metricsStore'
import { NodeTooltip } from '../ui/NodeTooltip'

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
  const movementLocked = useCanvasStore((s) => s.movementLocked)
  const updateNodePosition = useCanvasStore((s) => s.updateNodePosition)
  const setConnectHoverTargetId = useCanvasStore((s) => s.setConnectHoverTargetId)
  const nodeStatus = useCanvasStore((s) => s.nodes[node.id]?.status ?? node.status)
  const metrics = useMetricsStore((s) => s.metrics[node.id])
  const nodesById = useCanvasStore((s) => s.nodes)
  const edgesById = useCanvasStore((s) => s.edges)
  const [hovered, setHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const expandProgress = useRef(0)
  const [displayProgress, setDisplayProgress] = useState(0)

  const { camera, gl, invalidate: inv } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  const selected = selectedId === node.id
  const isPendingSource =
    pendingSourceId === node.id &&
    isCanvasEditMode(mode) &&
    designTool === 'connect'
  const isClient = node.type === 'client'
  const { face, edge, healthEdge } = NODE_VISUAL[node.type]
  const health = computeHealthState(metrics, nodeStatus)
  const healthEdgeColor =
    health === 'error'
      ? healthEdge.error
      : health === 'high-load'
        ? healthEdge.highLoad
        : edge
  const edgeColor = selected ? '#FFD700' : healthEdgeColor
  const replicasRaw = Number(
    node.type === 'database'
      ? (node.config.readReplicas ?? 0)
      : (node.config.replicas ?? 1)
  )
  const replicas = Number.isFinite(replicasRaw)
    ? (node.type === 'database'
      ? Math.max(0, Math.floor(replicasRaw))
      : Math.max(1, Math.floor(replicasRaw)))
    : (node.type === 'database' ? 0 : 1)
  const visualReplicas = node.type === 'database'
    ? Math.min(3, replicas + 1)
    : Math.min(3, replicas)
  const hasReplicaStack =
    (
      node.type === 'compute' ||
      node.type === 'worker' ||
      node.type === 'cache' ||
      node.type === 'database'
    ) &&
    visualReplicas > 1

  useEffect(() => {
    if (!hasReplicaStack || !selected) {
      setExpanded(false)
    }
  }, [hasReplicaStack, selected])

  const connectedNeighborAvgX = useMemo(() => {
    const neighbors: number[] = []
    for (const e of Object.values(edgesById)) {
      if (e.sourceId === node.id && nodesById[e.targetId]) {
        neighbors.push(nodesById[e.targetId]!.position[0])
      } else if (e.targetId === node.id && nodesById[e.sourceId]) {
        neighbors.push(nodesById[e.sourceId]!.position[0])
      }
    }
    if (neighbors.length === 0) return 0
    return neighbors.reduce((s, v) => s + v, 0) / neighbors.length
  }, [edgesById, nodesById, node.id])

  const preferredSign = connectedNeighborAvgX >= node.position[0] ? -1 : 1

  const replicaOffsets = useMemo(() => {
    const out: [number, number, number][] = [[0, 0, 0]]
    for (let i = 1; i < visualReplicas; i++) {
      // Camera is at [10,10,10] — "behind" the node from the viewer's perspective
      // is the +X/+Z direction (away from camera). Step each replica there so it
      // peeks out from behind the primary in the iso view, like stacked cards.
      const s = 0.3 * i
      const collapsed: [number, number, number] = [s, 0, s]
      const side = i % 2 === 1 ? preferredSign : -preferredSign
      const step = Math.ceil(i / 2)
      const expandedOffset: [number, number, number] = [
        0.55 * side * step,
        -0.18 * step,
        0.48 * step,
      ]
      const staggerStart = Math.min(0.35, i * 0.12)
      const localProgress = THREE.MathUtils.clamp(
        (displayProgress - staggerStart) / (1 - staggerStart),
        0,
        1
      )
      out.push([
        THREE.MathUtils.lerp(collapsed[0], expandedOffset[0], localProgress),
        THREE.MathUtils.lerp(collapsed[1], expandedOffset[1], localProgress),
        THREE.MathUtils.lerp(collapsed[2], expandedOffset[2], localProgress),
      ])
    }
    return out
  }, [visualReplicas, preferredSign, displayProgress])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const mat = mesh.material as THREE.MeshStandardMaterial
    expandProgress.current = THREE.MathUtils.damp(
      expandProgress.current,
      expanded ? 1 : 0,
      7,
      1 / 60
    )
    if (Math.abs(displayProgress - expandProgress.current) > 0.001) {
      setDisplayProgress(expandProgress.current)
      inv()
    }
    const st = useCanvasStore.getState()
    if (!isMetricsViewportMode(st.mode)) {
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
    const latestMetrics = useMetricsStore.getState().metrics[node.id]
    const state = computeHealthState(latestMetrics, n.status)
    if (state === 'normal') {
      mat.emissive.set('#1E8A54')
      mat.emissiveIntensity = 0.2
    } else if (state === 'error') {
      mat.emissive.set('#E05E8A')
      mat.emissiveIntensity = 0.3 + Math.sin(Date.now() * 0.012) * 0.2
      inv()
    } else if (state === 'high-load' || n.status === 'provisioning') {
      mat.emissive.set('#F0A040')
      mat.emissiveIntensity = 0.2 + Math.sin(Date.now() * 0.003) * 0.15
      inv()
    } else {
      mat.emissive.set('#000000')
      mat.emissiveIntensity = 0
    }
    /* Do not invalidate for idle/healthy — constant inv() × N nodes × 60fps breaks drei Html when the inspector opens. */
  })

  const bind = useDrag(
    ({ xy: [cx, cy], dragging, buttons }) => {
      if (isClient) return
      const st = useCanvasStore.getState()
      if (st.movementLocked) return
      const canDragLive = st.mode === 'live'
      const canDragSimulate = st.mode === 'simulate'
      const canDragDesign =
        st.mode === 'design' && st.designTool === 'select'
      if ((!canDragLive && !canDragSimulate && !canDragDesign) || !dragging) return
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

  const dragBind = bind()

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    const toggleAllowed =
      hasReplicaStack &&
      (isMetricsViewportMode(mode) ||
        (isCanvasEditMode(mode) && designTool === 'select'))
    if (toggleAllowed) setExpanded((v) => !v)
    if (isMetricsViewportMode(mode)) {
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
    const sourceNode = s.nodes[pending]
    if (!sourceNode) {
      s.setPendingSource(null)
      return
    }
    s.addEdge({
      id: crypto.randomUUID(),
      sourceId: pending,
      targetId: node.id,
      protocol: defaultEdgeProtocol(sourceNode.type, node.type),
      animated: false,
    })
    s.setPendingSource(null)
    s.selectNode(node.id)
  }

  // Node box dimensions — height intentionally slim so stacked replicas peek out cleanly
  const nodeW = isClient ? 1.0 : 1.4
  const nodeH = isClient ? 0.28 : 0.35
  const nodeD = isClient ? 1.0 : 1.4

  return (
    <group position={node.position}>
      {isPendingSource ? <PendingSourceRing /> : null}
      {/* Render replica meshes BEFORE the primary so they sit behind it in depth */}
      {hasReplicaStack
        ? replicaOffsets.slice(1).map((offset, idx) => {
            // Slightly darker per step so they read as "further back" — fully opaque.
            const darken = 1 - (idx + 1) * 0.10
            const replicaFace = '#' + new THREE.Color(face)
              .multiplyScalar(darken)
              .getHexString()
            return (
            <group key={`${node.id}-replica-${idx + 1}`} position={offset}>
              <mesh>
                <boxGeometry args={[nodeW, nodeH, nodeD]} />
                <meshStandardMaterial color={replicaFace} roughness={0.7} metalness={0} />
                <Edges threshold={15} color={edgeColor} />
              </mesh>
              {expanded ? (
                <Html
                  position={[0, -0.5, 0]}
                  center
                  zIndexRange={[20, 10]}
                  style={{ pointerEvents: 'none' }}
                >
                  <div className="pointer-events-none rounded bg-black/60 px-1 py-px font-mono text-[9px] text-zinc-200">
                    replica {idx + 1}
                  </div>
                </Html>
              ) : null}
              {expanded ? (
                <Line
                  points={[
                    [0, 0, 0],
                    [-offset[0], -offset[1], -offset[2]],
                  ]}
                  raycast={() => null}
                  color="#9CA3AF"
                  lineWidth={1}
                  dashed
                  dashScale={4}
                  dashSize={0.4}
                  gapSize={0.25}
                  transparent
                  opacity={0.45}
                />
              ) : null}
            </group>
          )
          })
        : null}
      {/* Primary node — rendered after replicas so it occludes them in front */}
      <mesh
        ref={meshRef}
        {...dragBind}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          if (e.button === 0) e.stopPropagation()
          if (!movementLocked) {
            dragBind.onPointerDown?.(e as unknown as ReactPointerEvent<HTMLElement>)
          }
        }}
        onClick={handleClick}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
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
        <boxGeometry args={[nodeW, nodeH, nodeD]} />
        <meshStandardMaterial color={face} roughness={0.7} metalness={0} />
        <Edges threshold={15} color={edgeColor} />
      </mesh>
      <Html
        position={[0, 0.6, 0]}
        center
        zIndexRange={[20, 10]}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{ pointerEvents: 'none' }}>
          <div
            className="rounded-full bg-white px-1.5 py-0.5 font-sans text-gray-900 shadow"
            style={{
              fontSize: 11,
              whiteSpace: 'nowrap',
            }}
          >
            {node.label}
            {hasReplicaStack && !expanded ? (
              <span className="ml-1 font-mono text-[8px] text-sky-700">
                {node.type === 'database' ? `+${replicas} read` : `×${replicas}`}
              </span>
            ) : null}
          </div>
          {hasReplicaStack ? (
            <div className="mt-1 text-center font-mono text-[8px] text-zinc-300/65">
              {expanded ? '˄ collapse' : '˄ expand'}
            </div>
          ) : null}
          {hasReplicaStack && expanded ? (
            <div className="mt-0.5 text-center font-mono text-[8px] text-zinc-200/80">
              primary
            </div>
          ) : null}
        </div>
      </Html>
      {isMetricsViewportMode(mode) && hovered ? (
        <NodeTooltip
          node={node}
          metrics={metrics}
          health={health}
          align={node.position[0] > 0 ? 'left' : 'right'}
        />
      ) : null}
    </group>
  )
}
