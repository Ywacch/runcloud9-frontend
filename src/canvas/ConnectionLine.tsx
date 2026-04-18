import { Html, Line } from '@react-three/drei'
import { type ThreeEvent } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { manhattanWaypoints, midpointAlongWaypoints } from '../lib/manhattan'
import { NODE_VISUAL } from '../lib/nodeVisual'
import {
  isCanvasEditMode,
  isMetricsViewportMode,
  useCanvasStore,
  type CanvasEdge,
} from '../store/canvasStore'
import { EdgeParticles } from './EdgeParticles'

function protocolLabel(protocol: CanvasEdge['protocol']): string {
  return protocol === 'http' ? 'HTTP' : 'TCP'
}

interface ConnectionLineProps {
  edge: CanvasEdge
}

export function ConnectionLine({ edge }: ConnectionLineProps) {
  const mode = useCanvasStore((s) => s.mode)
  const designTool = useCanvasStore((s) => s.designTool)
  const nodes = useCanvasStore((s) => s.nodes)
  const removeEdge = useCanvasStore((s) => s.removeEdge)

  const source = nodes[edge.sourceId]
  const target = nodes[edge.targetId]

  const waypoints = useMemo(() => {
    if (!source || !target) return [] as [number, number, number][]
    return manhattanWaypoints(source.position, target.position)
  }, [source, target])

  const points = useMemo(
    () => waypoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    [waypoints]
  )

  const labelPos = useMemo(() => midpointAlongWaypoints(waypoints), [waypoints])

  const isLive = isMetricsViewportMode(mode)

  const lineWidth =
    isCanvasEditMode(mode) && designTool === 'erase' ? 14 : 2

  const onContextMenu = (e: { stopPropagation: () => void; nativeEvent: Event }) => {
    if (!isCanvasEditMode(mode)) return
    e.stopPropagation()
    e.nativeEvent.preventDefault()
    removeEdge(edge.id)
  }

  const onErasePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!isCanvasEditMode(mode) || designTool !== 'erase' || e.button !== 0)
      return
    e.stopPropagation()
    removeEdge(edge.id)
  }

  if (!source || !target || points.length < 2) return null

  const particleColor = NODE_VISUAL[source.type].face

  return (
    <>
      {isLive ? (
        <>
          <Line
            points={points}
            color="#64748b"
            lineWidth={2}
            transparent
            opacity={0.45}
            dashed={false}
            raycast={() => null}
            onContextMenu={onContextMenu}
          />
          {edge.animated ? (
            <EdgeParticles
              waypoints={waypoints}
              sourceNodeId={edge.sourceId}
              connectionId={edge.id}
              animated={edge.animated}
              color={particleColor}
            />
          ) : null}
        </>
      ) : (
        <Line
          points={points}
          color="#666666"
          lineWidth={lineWidth}
          onContextMenu={onContextMenu}
          onPointerDown={onErasePointerDown}
        />
      )}
      <Html
        position={labelPos}
        center
        zIndexRange={[20, 10]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="pointer-events-none rounded bg-gray-800 px-1.5 py-0.5 font-sans text-[10px] text-white"
          style={{ whiteSpace: 'nowrap' }}
        >
          {protocolLabel(edge.protocol)}
        </div>
      </Html>
    </>
  )
}
