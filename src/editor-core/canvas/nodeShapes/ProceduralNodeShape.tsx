import { Edges } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { CanvasNode } from '../../stores/canvasStore'
import { useNodeLogo } from '../useNodeLogo'
import { getNodeUnitSpec, getUnitCenterY, type NodeUnitSpec } from './nodeBounds'
import { getMqClusterOffsets } from './mqClusterLayout'
import { darkenHex, lightenHex } from './shapeUtils'

const OUTLINE_THRESHOLD = 15
const BODY_ROUGHNESS = 0.8
const BODY_MATERIAL_ROUGHNESS = 0.65
const BODY_MATERIAL_METALNESS = 0.12

interface ProceduralNodeShapeProps {
  type: CanvasNode['type']
  /** Body color applied through the shared material; replicas share emissive state. */
  face: string
  /** Outline color (typically #333333 for blueprint; selected/health overrides). */
  edgeColor: string
  /** Shared material so health glow / walkthrough emissive applies to every unit. */
  bodyMaterial: THREE.MeshStandardMaterial
  /**
   * Number of stack units to render. The shape always renders 1 unit by default
   * and grows upward along +Y when `replicas` is greater than 1.
   */
  replicas?: number
  /**
   * When `replicas === 1`, draw the geometry that would appear at this vertical
   * index in a multi-unit stack (used for exploded replica layout).
   */
  singleStackSlot?: number
  /**
   * Message queue only: `partitions <= 1` → one horizontal hex tube; `> 1` →
   * honeycomb cluster (up to 5 barrels) driven by inspector partitions.
   */
  mqPartitions?: number
  /**
   * With `singleStackSlot`, center that slab on local y=0 so parent `<group>`
   * positions can place exploded replicas without double-applying stack heights.
   */
  stackUnitUseLocalOrigin?: boolean
}

/** Static, solid disc cap used as an end cap or accent rim. */
function HexCap({
  radius,
  thickness,
  position,
  rotation,
  color,
  edgeColor,
  nodeType,
  withLogo = false,
}: {
  radius: number
  thickness: number
  position: [number, number, number]
  rotation?: [number, number, number]
  color: string
  edgeColor: string
  nodeType?: string
  withLogo?: boolean
}) {
  const logoTexture = useNodeLogo(withLogo ? (nodeType ?? '') : 'compute')
  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[radius, radius, thickness, 6]} />
      {logoTexture ? (
        <meshStandardMaterial
          map={logoTexture}
          roughness={0.7}
          metalness={0.05}
        />
      ) : (
        <meshStandardMaterial color={color} roughness={BODY_ROUGHNESS} metalness={0} />
      )}
      <Edges threshold={OUTLINE_THRESHOLD} color={edgeColor} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Database — solid disc                                              */
/* ------------------------------------------------------------------ */

function DatabaseUnit({
  yCenter,
  height,
  bodyMaterial,
  edgeColor,
  accent,
  nodeType,
  withLogo = false,
}: {
  yCenter: number
  height: number
  bodyMaterial: THREE.MeshStandardMaterial
  edgeColor: string
  accent: string
  nodeType?: string
  withLogo?: boolean
}) {
  return (
    <group position={[0, yCenter, 0]}>
      <mesh material={bodyMaterial}>
        <cylinderGeometry args={[0.4, 0.4, height, 32]} />
        <Edges threshold={OUTLINE_THRESHOLD} color={edgeColor} />
      </mesh>
      <HexCap
        radius={0.34}
        thickness={0.018}
        position={[0, height / 2 + 0.012, 0]}
        color={accent}
        edgeColor={edgeColor}
        nodeType={nodeType}
        withLogo={withLogo}
      />
    </group>
  )
}

function DatabaseStack({
  face,
  edgeColor,
  bodyMaterial,
  replicas,
  spec,
  singleStackSlot,
  stackUnitUseLocalOrigin,
  nodeType,
}: {
  face: string
  edgeColor: string
  bodyMaterial: THREE.MeshStandardMaterial
  replicas: number
  spec: NodeUnitSpec
  singleStackSlot?: number
  stackUnitUseLocalOrigin?: boolean
  nodeType?: string
}) {
  const accent = useMemo(() => lightenHex(face, 0.22), [face])
  const topIndex = replicas - 1
  if (singleStackSlot != null) {
    const y =
      stackUnitUseLocalOrigin ? 0 : getUnitCenterY(spec, singleStackSlot)
    return (
      <DatabaseUnit
        yCenter={y}
        height={spec.h}
        bodyMaterial={bodyMaterial}
        edgeColor={edgeColor}
        accent={accent}
        nodeType={nodeType}
        withLogo={singleStackSlot === topIndex}
      />
    )
  }
  return (
    <group>
      {Array.from({ length: replicas }, (_, i) => (
        <DatabaseUnit
          key={i}
          yCenter={getUnitCenterY(spec, i)}
          height={spec.h}
          bodyMaterial={bodyMaterial}
          edgeColor={edgeColor}
          accent={accent}
          nodeType={nodeType}
          withLogo={i === topIndex}
        />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Cache — hexagonal disc                                             */
/* ------------------------------------------------------------------ */

function CacheUnit({
  yCenter,
  height,
  bodyMaterial,
  edgeColor,
  accent,
}: {
  yCenter: number
  height: number
  bodyMaterial: THREE.MeshStandardMaterial
  edgeColor: string
  accent: string
}) {
  return (
    <group position={[0, yCenter, 0]}>
      <mesh material={bodyMaterial}>
        <cylinderGeometry args={[0.38, 0.38, height, 6]} />
        <Edges threshold={OUTLINE_THRESHOLD} color={edgeColor} />
      </mesh>
      <HexCap
        radius={0.33}
        thickness={0.018}
        position={[0, height / 2 + 0.012, 0]}
        color={accent}
        edgeColor={edgeColor}
      />
    </group>
  )
}

function CacheStack({
  face,
  edgeColor,
  bodyMaterial,
  replicas,
  spec,
  singleStackSlot,
  stackUnitUseLocalOrigin,
}: {
  face: string
  edgeColor: string
  bodyMaterial: THREE.MeshStandardMaterial
  replicas: number
  spec: NodeUnitSpec
  singleStackSlot?: number
  stackUnitUseLocalOrigin?: boolean
}) {
  const accent = useMemo(() => lightenHex(face, 0.25), [face])
  if (singleStackSlot != null) {
    const y =
      stackUnitUseLocalOrigin ? 0 : getUnitCenterY(spec, singleStackSlot)
    return (
      <CacheUnit
        yCenter={y}
        height={spec.h}
        bodyMaterial={bodyMaterial}
        edgeColor={edgeColor}
        accent={accent}
      />
    )
  }
  return (
    <group>
      {Array.from({ length: replicas }, (_, i) => (
        <CacheUnit
          key={i}
          yCenter={getUnitCenterY(spec, i)}
          height={spec.h}
          bodyMaterial={bodyMaterial}
          edgeColor={edgeColor}
          accent={accent}
        />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Compute / Worker — server blade                                    */
/* ------------------------------------------------------------------ */

function BladeUnit({
  w,
  h,
  d,
  yCenter,
  bodyMaterial,
  edgeColor,
  accent,
}: {
  w: number
  h: number
  d: number
  yCenter: number
  bodyMaterial: THREE.MeshStandardMaterial
  edgeColor: string
  accent: string
}) {
  return (
    <group position={[0, yCenter, 0]}>
      <mesh material={bodyMaterial}>
        <boxGeometry args={[w, h, d]} />
        <Edges threshold={OUTLINE_THRESHOLD} color={edgeColor} />
      </mesh>
      <mesh position={[0, h / 2 + 0.012, 0]}>
        <boxGeometry args={[w * 0.88, 0.02, d * 0.88]} />
        <meshStandardMaterial color={accent} roughness={BODY_ROUGHNESS} metalness={0} />
        <Edges threshold={OUTLINE_THRESHOLD} color={edgeColor} />
      </mesh>
    </group>
  )
}

function BladeStack({
  face,
  edgeColor,
  bodyMaterial,
  replicas,
  spec,
  singleStackSlot,
  stackUnitUseLocalOrigin,
}: {
  face: string
  edgeColor: string
  bodyMaterial: THREE.MeshStandardMaterial
  replicas: number
  spec: NodeUnitSpec
  singleStackSlot?: number
  stackUnitUseLocalOrigin?: boolean
}) {
  const accent = useMemo(() => lightenHex(face, 0.18), [face])
  if (singleStackSlot != null) {
    const y =
      stackUnitUseLocalOrigin ? 0 : getUnitCenterY(spec, singleStackSlot)
    return (
      <BladeUnit
        w={spec.w}
        h={spec.h}
        d={spec.d}
        yCenter={y}
        bodyMaterial={bodyMaterial}
        edgeColor={edgeColor}
        accent={accent}
      />
    )
  }
  return (
    <group>
      {Array.from({ length: replicas }, (_, i) => (
        <BladeUnit
          key={i}
          w={spec.w}
          h={spec.h}
          d={spec.d}
          yCenter={getUnitCenterY(spec, i)}
          bodyMaterial={bodyMaterial}
          edgeColor={edgeColor}
          accent={accent}
        />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Load balancer — single wide hex platform                           */
/* ------------------------------------------------------------------ */

function LoadBalancerShape({
  face,
  edgeColor,
  bodyMaterial,
  spec,
  nodeType,
}: {
  face: string
  edgeColor: string
  bodyMaterial: THREE.MeshStandardMaterial
  spec: NodeUnitSpec
  nodeType?: string
}) {
  const accent = useMemo(() => lightenHex(face, 0.24), [face])
  const yCenter = getUnitCenterY(spec, 0)
  return (
    <group position={[0, yCenter, 0]}>
      <mesh material={bodyMaterial}>
        <cylinderGeometry args={[0.55, 0.55, spec.h, 6]} />
        <Edges threshold={OUTLINE_THRESHOLD} color={edgeColor} />
      </mesh>
      <HexCap
        radius={0.5}
        thickness={0.022}
        position={[0, spec.h / 2 + 0.014, 0]}
        color={accent}
        edgeColor={edgeColor}
        nodeType={nodeType}
        withLogo
      />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Client — single tile                                               */
/* ------------------------------------------------------------------ */

function ClientShape({
  face,
  edgeColor,
  bodyMaterial,
  spec,
}: {
  face: string
  edgeColor: string
  bodyMaterial: THREE.MeshStandardMaterial
  spec: NodeUnitSpec
}) {
  const accent = useMemo(() => lightenHex(face, 0.2), [face])
  const yCenter = getUnitCenterY(spec, 0)
  return (
    <group position={[0, yCenter, 0]}>
      <mesh material={bodyMaterial}>
        <boxGeometry args={[0.85, spec.h, 0.85]} />
        <Edges threshold={OUTLINE_THRESHOLD} color={edgeColor} />
      </mesh>
      <mesh position={[0, spec.h / 2 + 0.012, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.04, 6]} />
        <meshStandardMaterial color={accent} roughness={BODY_ROUGHNESS} metalness={0} />
        <Edges threshold={OUTLINE_THRESHOLD} color={edgeColor} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Message Queue — honeycomb cluster of horizontal hex tubes (Kinesis) */
/* ------------------------------------------------------------------ */

function MessageQueueShape({
  face,
  edgeColor,
  bodyMaterial,
  spec,
  partitions,
}: {
  face: string
  edgeColor: string
  bodyMaterial: THREE.MeshStandardMaterial
  spec: NodeUnitSpec
  partitions: number
}) {
  const cluster = partitions > 1
  const tubeR = cluster ? 0.18 : 0.24
  const tubeLen = cluster ? spec.w : spec.w * 0.92
  const tubeCount = cluster ? Math.min(5, partitions) : 1
  const offsets = useMemo(
    () => getMqClusterOffsets(tubeCount, tubeR),
    [cluster, partitions, tubeR, tubeCount],
  )
  const capColor = useMemo(() => darkenHex(face, 0.45), [face])
  let maxR = 0
  for (const [dz, dy] of offsets) {
    maxR = Math.max(maxR, Math.hypot(dz, dy))
  }
  const clusterY = spec.baseY + tubeR * Math.sqrt(3) + maxR * 0.5

  return (
    <group position={[0, clusterY, 0]}>
      {offsets.map(([dz, dy], i) => (
        <group key={i} position={[0, dy, dz]}>
          <mesh
            material={bodyMaterial}
            rotation={[Math.PI / 6, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[tubeR, tubeR, tubeLen, 6]} />
            <Edges threshold={OUTLINE_THRESHOLD} color={edgeColor} />
          </mesh>
          <mesh
            position={[tubeLen / 2 + 0.005, 0, 0]}
            rotation={[Math.PI / 6, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[tubeR * 0.78, tubeR * 0.78, 0.02, 6]} />
            <meshStandardMaterial
              color={capColor}
              roughness={BODY_ROUGHNESS}
              metalness={0}
            />
            <Edges threshold={OUTLINE_THRESHOLD} color={edgeColor} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

export function ProceduralNodeShape({
  type,
  face,
  edgeColor,
  bodyMaterial,
  replicas = 1,
  singleStackSlot,
  mqPartitions = 1,
  stackUnitUseLocalOrigin = false,
}: ProceduralNodeShapeProps) {
  const spec = getNodeUnitSpec(type)
  const count = Math.max(1, Math.floor(replicas))
  const slot =
    count === 1 && singleStackSlot != null
      ? Math.max(0, Math.floor(singleStackSlot))
      : undefined
  const mqPart = Math.max(1, Math.min(32, Math.floor(mqPartitions)))

  // Keep the shared material consistent across calls so emissive (health glow,
  // walkthrough dimming) propagates to every unit in the stack.
  bodyMaterial.color.set(face)
  bodyMaterial.roughness = BODY_MATERIAL_ROUGHNESS
  bodyMaterial.metalness = BODY_MATERIAL_METALNESS

  switch (type) {
    case 'database':
      return (
        <DatabaseStack
          face={face}
          edgeColor={edgeColor}
          bodyMaterial={bodyMaterial}
          replicas={count}
          spec={spec}
          singleStackSlot={slot}
          stackUnitUseLocalOrigin={stackUnitUseLocalOrigin}
          nodeType={type}
        />
      )
    case 'cache':
      return (
        <CacheStack
          face={face}
          edgeColor={edgeColor}
          bodyMaterial={bodyMaterial}
          replicas={count}
          spec={spec}
          singleStackSlot={slot}
          stackUnitUseLocalOrigin={stackUnitUseLocalOrigin}
        />
      )
    case 'message_queue':
      return (
        <MessageQueueShape
          face={face}
          edgeColor={edgeColor}
          bodyMaterial={bodyMaterial}
          spec={spec}
          partitions={mqPart}
        />
      )
    case 'load_balancer':
      return (
        <LoadBalancerShape
          face={face}
          edgeColor={edgeColor}
          bodyMaterial={bodyMaterial}
          spec={spec}
          nodeType={type}
        />
      )
    case 'worker':
    case 'compute':
      return (
        <BladeStack
          face={face}
          edgeColor={edgeColor}
          bodyMaterial={bodyMaterial}
          replicas={count}
          spec={spec}
          singleStackSlot={slot}
          stackUnitUseLocalOrigin={stackUnitUseLocalOrigin}
        />
      )
    case 'client':
    default:
      return (
        <ClientShape
          face={face}
          edgeColor={edgeColor}
          bodyMaterial={bodyMaterial}
          spec={spec}
        />
      )
  }
}
