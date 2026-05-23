import { Html, Line } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { HealthRim } from './HealthRim'
import { getLabelY, getNodeUnitSpec } from './nodeShapes/nodeBounds'
import { NodeCollider } from './nodeShapes/NodeCollider'
import { ReplicaStackVisual } from './nodeShapes/ReplicaStackVisual'
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

  const { camera, gl, invalidate: inv } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  const selected = selectedId === node.id
  const isPendingSource =
    pendingSourceId === node.id &&
    isCanvasEditMode(mode) &&
    designTool === 'connect'
  const isClient = node.type === 'client'
  const { face, edge, healthEdge } = NODE_VISUAL[node.type]
  const unitSpec = getNodeUnitSpec(node.type)
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: face,
        roughness: 0.65,
        metalness: 0.12,
      }),
    [face],
  )
  const health = computeHealthState(metrics, nodeStatus)
  const healthEdgeColor =
    health === 'error'
      ? healthEdge.error
      : health === 'warning'
        ? healthEdge.warning
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

  const mqPartitions = useMemo(() => {
    if (node.type !== 'message_queue') return 1
    const n = Number(node.config.partitions ?? 1)
    return Number.isFinite(n)
      ? Math.max(1, Math.min(32, Math.floor(n)))
      : 1
  }, [node.type, node.config.partitions])

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

  const replicaSpreadOffsets = useMemo((): [number, number, number][] => {
    const out: [number, number, number][] = []
    for (let i = 0; i < visualReplicas; i++) {
      if (i === 0) {
        out.push([0, 0.1, 0])
        continue
      }
      const side = i % 2 === 1 ? preferredSign : -preferredSign
      const step = Math.ceil(i / 2)
      out.push([0.55 * side * step, -0.12 * step, 0.48 * step])
    }
    return out
  }, [visualReplicas, preferredSign])

  useEffect(() => {
    if (!hasReplicaStack || !selected) {
      setExpanded(false)
    }
  }, [hasReplicaStack, selected])

  const toggleReplicaExpandAllowed =
    hasReplicaStack &&
    (isMetricsViewportMode(mode) ||
      (isCanvasEditMode(mode) && designTool === 'select'))

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const mat = mesh.material as THREE.MeshStandardMaterial
    const st = useCanvasStore.getState()
    const walkthroughRunning =
      st.walkthroughActiveNodeId != null ||
      st.walkthroughParticipatingNodeIds.length > 0
    const walkthroughActive = st.walkthroughActiveNodeId === node.id
    const walkthroughVisited = st.walkthroughVisitedNodeIds.includes(node.id)
    const walkthroughParticipating =
      st.walkthroughParticipatingNodeIds.includes(node.id)

    if (walkthroughRunning && st.mode === 'design') {
      mat.transparent = true
      if (walkthroughActive) {
        mat.emissive.setRGB(0.15, 0.75, 0.9)
        mat.emissiveIntensity = 0.45 + Math.sin(Date.now() * 0.004) * 0.15
        mat.opacity = 1
        inv()
      } else if (walkthroughVisited) {
        mat.emissive.setRGB(0.08, 0.35, 0.42)
        mat.emissiveIntensity = 0.15
        mat.opacity = 0.92
      } else if (walkthroughParticipating) {
        mat.emissive.set('#000000')
        mat.emissiveIntensity = 0
        mat.opacity = 0.55
      } else {
        mat.emissive.set('#000000')
        mat.emissiveIntensity = 0
        mat.opacity = 0.25
      }
      return
    }

    mat.transparent = false
    mat.opacity = 1

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
    const pulseNarrative = useCanvasStore.getState().narrativeHighlightNodeIds.includes(
      node.id
    )

    let er = 0
    let eg = 0
    let eb = 0
    let emissiveIntensity = 0

    switch (state) {
      case 'idle':
        break
      case 'healthy':
        er = 0.12
        eg = 0.54
        eb = 0.33
        emissiveIntensity = 0.2
        break
      case 'warning':
        er = 0.94
        eg = 0.63
        eb = 0.25
        emissiveIntensity = 0.2 + Math.sin(Date.now() * 0.003) * 0.15
        inv()
        break
      case 'error':
        er = 0.88
        eg = 0.37
        eb = 0.54
        emissiveIntensity = 0.3 + Math.sin(Date.now() * 0.012) * 0.2
        inv()
        break
    }

    if (pulseNarrative) {
      er = Math.min(1, er + 0.12)
      eg = Math.min(1, eg + 0.38)
      eb = Math.min(1, eb + 0.48)
      emissiveIntensity += 0.12 + Math.sin(Date.now() * 0.005) * 0.07
      inv()
    }

    mat.emissive.setRGB(er, eg, eb)
    mat.emissiveIntensity = emissiveIntensity
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
    if (toggleReplicaExpandAllowed) {
      setExpanded((v) => !v)
    }
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

  const labelY = useMemo(() => {
    const stacked = getLabelY(unitSpec, visualReplicas)
    if (!expanded || !hasReplicaStack) return stacked
    const maxTip = Math.max(
      ...replicaSpreadOffsets.map(([, yy]) => yy + unitSpec.h * 0.55),
      stacked,
    )
    return maxTip + unitSpec.labelMargin
  }, [
    expanded,
    hasReplicaStack,
    replicaSpreadOffsets,
    unitSpec,
    visualReplicas,
  ])

  return (
    <group position={node.position}>
      {isPendingSource ? <PendingSourceRing /> : null}
      {hasReplicaStack && expanded ? (
        <>
          {replicaSpreadOffsets.map((offset, idx) => (
            <group key={`${node.id}-slot-${idx}`} position={offset}>
              {idx === 0 ? (
                <>
                  <NodeCollider
                    ref={meshRef}
                    type={node.type}
                    face={face}
                    edgeColor={edgeColor}
                    bodyMaterial={bodyMaterial}
                    replicas={1}
                    mqPartitions={mqPartitions}
                    singleStackSlot={0}
                    stackUnitUseLocalOrigin
                    dragBind={dragBind}
                    movementLocked={movementLocked}
                    onClick={handleClick}
                    onPointerEnter={() => setHovered(true)}
                    onPointerLeave={() => setHovered(false)}
                    onPointerOver={() => {
                      if (!isCanvasEditMode(mode) || designTool !== 'connect')
                        return
                      const pending = useCanvasStore.getState().pendingSourceId
                      if (pending && pending !== node.id) {
                        setConnectHoverTargetId(node.id)
                      }
                    }}
                    onPointerOut={() => {
                      if (
                        useCanvasStore.getState().connectHoverTargetId === node.id
                      ) {
                        setConnectHoverTargetId(null)
                      }
                    }}
                  />
                  <Html
                    position={[0, -0.48, 0]}
                    center
                    zIndexRange={[20, 10]}
                    style={{ pointerEvents: 'none' }}
                  >
                    <div className="pointer-events-none rounded bg-black/60 px-1 py-px text-center font-mono text-[9px] text-zinc-200">
                      <div>˄ collapse</div>
                      <div className="text-zinc-400">primary</div>
                    </div>
                  </Html>
                </>
              ) : (
                <>
                  <ReplicaStackVisual
                    type={node.type}
                    face={face}
                    edgeColor={edgeColor}
                    darkenFactor={1 - idx * 0.1}
                    replicas={1}
                    singleStackSlot={idx}
                    stackUnitUseLocalOrigin
                    mqPartitions={mqPartitions}
                  />
                  <Html
                    position={[0, -0.42, 0]}
                    center
                    zIndexRange={[20, 10]}
                    style={{ pointerEvents: 'none' }}
                  >
                    <div className="pointer-events-none rounded bg-black/60 px-1 py-px font-mono text-[9px] text-zinc-200">
                      replica {idx}
                    </div>
                  </Html>
                  <Line
                    points={[
                      [0, 0, 0],
                      [
                        replicaSpreadOffsets[0][0] - offset[0],
                        replicaSpreadOffsets[0][1] - offset[1],
                        replicaSpreadOffsets[0][2] - offset[2],
                      ],
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
                </>
              )}
            </group>
          ))}
        </>
      ) : (
        <NodeCollider
          ref={meshRef}
          type={node.type}
          face={face}
          edgeColor={edgeColor}
          bodyMaterial={bodyMaterial}
          replicas={visualReplicas}
          mqPartitions={mqPartitions}
          dragBind={dragBind}
          movementLocked={movementLocked}
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
        />
      )}
      <Html
        position={[0, labelY, 0]}
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
            {hasReplicaStack ? (
              <span className="ml-1 font-mono text-[8px] text-sky-700">
                {node.type === 'database' ? `+${replicas} read` : `×${replicas}`}
              </span>
            ) : null}
          </div>
          {hasReplicaStack && !expanded ? (
            <div className="mt-1 text-center font-mono text-[8px] text-zinc-300/65">
              ˄ expand
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
      {!(hasReplicaStack && expanded) ? (
        <HealthRim
          health={health}
          type={node.type}
          spec={unitSpec}
          replicas={visualReplicas}
          mqPartitions={mqPartitions}
        />
      ) : null}
    </group>
  )
}
