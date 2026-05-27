import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import type { HealthState } from '../domain/healthThresholds'
import type { CanvasNode } from '../stores/canvasStore'
import { getMqClusterOffsets } from './nodeShapes/mqClusterLayout'
import { getUnitCenterY, type NodeUnitSpec } from './nodeShapes/nodeBounds'

/** Slight inflation so BackSide faces peek past the procedural body. */
const RIM_INFLATE = 1.06

const RIM_CONFIG: Record<
  Exclude<HealthState, 'idle'>,
  { color: string; pulseSpeed: number }
> = {
  healthy: { color: '#22c55e', pulseSpeed: 0 },
  warning: { color: '#f59e0b', pulseSpeed: 1.0 },
  error: { color: '#ef4444', pulseSpeed: 2.2 },
}

function useRimMaterial(config: (typeof RIM_CONFIG)[keyof typeof RIM_CONFIG] | null) {
  const material = useMemo(() => {
    if (!config) return null
    return new THREE.MeshBasicMaterial({
      color: config.color,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    })
  }, [config?.color])

  useEffect(() => () => material?.dispose(), [material])

  useFrame(({ clock }) => {
    if (!material || !config) return
    if (config.pulseSpeed === 0) {
      material.opacity = 0.35
    } else {
      material.opacity =
        0.25 +
        0.4 *
          Math.abs(Math.sin(clock.getElapsedTime() * Math.PI * config.pulseSpeed))
    }
  })

  return material
}

function RimMesh({
  material,
  position = [0, 0, 0],
  rotation,
  geometry,
}: {
  material: THREE.MeshBasicMaterial
  position?: [number, number, number]
  rotation?: [number, number, number]
  geometry: ReactNode
}) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      material={material}
      castShadow={false}
      receiveShadow={false}
    >
      {geometry}
    </mesh>
  )
}

/** Mirrors ProceduralNodeShape unit layouts (see shape components in that file). */
function ShapeMatchedRim({
  type,
  spec,
  replicas,
  mqPartitions,
  material,
}: {
  type: CanvasNode['type']
  spec: NodeUnitSpec
  replicas: number
  mqPartitions: number
  material: THREE.MeshBasicMaterial
}) {
  const count = Math.max(1, Math.floor(replicas))

  switch (type) {
    case 'compute':
    case 'worker':
      return (
        <group>
          {Array.from({ length: count }, (_, i) => (
            <RimMesh
              key={i}
              material={material}
              position={[0, getUnitCenterY(spec, i), 0]}
              geometry={
                <boxGeometry
                  args={[
                    spec.w * RIM_INFLATE,
                    spec.h * RIM_INFLATE,
                    spec.d * RIM_INFLATE,
                  ]}
                />
              }
            />
          ))}
        </group>
      )

    case 'database':
      return (
        <group>
          {Array.from({ length: count }, (_, i) => (
            <RimMesh
              key={i}
              material={material}
              position={[0, getUnitCenterY(spec, i), 0]}
              geometry={
                <cylinderGeometry
                  args={[
                    0.4 * RIM_INFLATE,
                    0.4 * RIM_INFLATE,
                    spec.h * RIM_INFLATE,
                    32,
                  ]}
                />
              }
            />
          ))}
        </group>
      )

    case 'cache':
      return (
        <group>
          {Array.from({ length: count }, (_, i) => (
            <RimMesh
              key={i}
              material={material}
              position={[0, getUnitCenterY(spec, i), 0]}
              geometry={
                <cylinderGeometry
                  args={[
                    0.38 * RIM_INFLATE,
                    0.38 * RIM_INFLATE,
                    spec.h * RIM_INFLATE,
                    6,
                  ]}
                />
              }
            />
          ))}
        </group>
      )

    case 'load_balancer': {
      const yCenter = getUnitCenterY(spec, 0)
      return (
        <RimMesh
          material={material}
          position={[0, yCenter, 0]}
          geometry={
            <cylinderGeometry
              args={[
                0.55 * RIM_INFLATE,
                0.55 * RIM_INFLATE,
                spec.h * RIM_INFLATE,
                6,
              ]}
            />
          }
        />
      )
    }

    case 'client': {
      const yCenter = getUnitCenterY(spec, 0)
      return (
        <RimMesh
          material={material}
          position={[0, yCenter, 0]}
          geometry={
            <boxGeometry
              args={[0.85 * RIM_INFLATE, spec.h * RIM_INFLATE, 0.85 * RIM_INFLATE]}
            />
          }
        />
      )
    }

    case 'message_queue': {
      const cluster = mqPartitions > 1
      const tubeR = cluster ? 0.18 : 0.24
      const tubeLen = (cluster ? spec.w : spec.w * 0.92) * RIM_INFLATE
      const tubeCount = cluster ? Math.min(5, mqPartitions) : 1
      const offsets = getMqClusterOffsets(tubeCount, tubeR)
      let maxR = 0
      for (const [dz, dy] of offsets) {
        maxR = Math.max(maxR, Math.hypot(dz, dy))
      }
      const clusterY = spec.baseY + tubeR * Math.sqrt(3) + maxR * 0.5
      const tubeRadius = tubeR * RIM_INFLATE

      return (
        <group position={[0, clusterY, 0]}>
          {offsets.map(([dz, dy], i) => (
            <RimMesh
              key={i}
              material={material}
              position={[0, dy, dz]}
              rotation={[Math.PI / 6, 0, Math.PI / 2]}
              geometry={
                <cylinderGeometry
                  args={[tubeRadius, tubeRadius, tubeLen, 6]}
                />
              }
            />
          ))}
        </group>
      )
    }

    default:
      return null
  }
}

export function HealthRim({
  health,
  type,
  spec,
  replicas = 1,
  mqPartitions = 1,
}: {
  health: HealthState
  type: CanvasNode['type']
  spec: NodeUnitSpec
  replicas?: number
  mqPartitions?: number
}) {
  const config = health === 'idle' ? null : RIM_CONFIG[health]
  const material = useRimMaterial(config)

  if (!config || !material) return null

  return (
    <ShapeMatchedRim
      type={type}
      spec={spec}
      replicas={replicas}
      mqPartitions={mqPartitions}
      material={material}
    />
  )
}
