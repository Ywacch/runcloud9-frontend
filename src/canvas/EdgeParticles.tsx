import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useMetricsStore } from '../store/metricsStore'
import { useSimulationStore } from '../store/simulationStore'

const MAX_PARTICLES = 200
const PARTICLE_SIZE = 0.04
function brightenColor(hex: string, factor: number): THREE.Color {
  const c = new THREE.Color(hex)
  return new THREE.Color(
    Math.min(1, c.r * factor),
    Math.min(1, c.g * factor),
    Math.min(1, c.b * factor),
  )
}

function buildPathData(waypoints: [number, number, number][]) {
  const pts = waypoints.map(([x, y, z]) => new THREE.Vector3(x, y, z))
  const segLen: number[] = []
  let total = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const d = pts[i].distanceTo(pts[i + 1])
    segLen.push(d)
    total += d
  }
  return { pts, segLen, total }
}

function sampleOnPath(
  pts: THREE.Vector3[],
  segLen: number[],
  total: number,
  t: number,
  out: THREE.Vector3,
) {
  if (pts.length < 2 || total < 1e-8) {
    out.copy(pts[0] ?? new THREE.Vector3())
    return
  }
  let d = ((t % 1) + 1) % 1
  d *= total
  for (let i = 0; i < segLen.length; i++) {
    if (d <= segLen[i]) {
      const u = segLen[i] < 1e-8 ? 0 : d / segLen[i]
      out.lerpVectors(pts[i], pts[i + 1], u)
      return
    }
    d -= segLen[i]
  }
  out.copy(pts[pts.length - 1])
}

interface EdgeParticlesProps {
  waypoints: [number, number, number][]
  sourceNodeId: string
  /** When set, simulation mode can use per-edge QPS from the worker. */
  connectionId?: string
  animated: boolean
  color?: string
  /** Render in design mode (architecture walkthrough). */
  forceRender?: boolean
  /** Fixed particle count when not driven by live metrics. */
  walkthroughParticleCount?: number
}

export function EdgeParticles({
  waypoints,
  sourceNodeId,
  connectionId,
  animated,
  color = '#4A90D9',
  forceRender = false,
  walkthroughParticleCount = 8,
}: EdgeParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const particleData = useRef<{ progress: number; speed: number }[]>([])

  const pathData = useMemo(() => buildPathData(waypoints), [waypoints])
  const invalidate = useThree((s) => s.invalidate)

  const geometry = useMemo(
    () => new THREE.SphereGeometry(PARTICLE_SIZE, 6, 6),
    [],
  )
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: brightenColor(color, 1.2),
        transparent: true,
        opacity: 0.52,
        toneMapped: false,
        depthWrite: false,
      }),
    [color],
  )

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh || !animated) return

    const sim = useSimulationStore.getState()
    const edgeQ =
      connectionId && sim.running
        ? sim.lastEdgeFlows[connectionId]
        : undefined
    const metrics = useMetricsStore.getState().metrics[sourceNodeId]
    const rps =
      typeof edgeQ === 'number' && edgeQ >= 0
        ? edgeQ
        : (metrics?.requestRate ?? 0)

    const targetCount = forceRender
      ? Math.max(2, Math.min(MAX_PARTICLES, walkthroughParticleCount))
      : rps > 0
        ? Math.max(1, Math.min(MAX_PARTICLES, Math.ceil(rps / 1000)))
        : 1

    const data = particleData.current
    while (data.length < targetCount) {
      data.push({ progress: Math.random(), speed: 0.3 + Math.random() * 0.4 })
    }
    while (data.length > targetCount) {
      data.pop()
    }

    const speedMultiplier = forceRender
      ? 1.2
      : rps <= 0
        ? 0.35
        : Math.max(0.5, Math.min(3, 0.5 + rps / 500))

    const { pts, segLen, total } = pathData

    for (let i = 0; i < data.length; i++) {
      const p = data[i]
      p.progress += delta * p.speed * speedMultiplier
      if (p.progress >= 1) {
        p.progress = 0
        p.speed = 0.3 + Math.random() * 0.4
      }

      sampleOnPath(pts, segLen, total, p.progress, dummy.position)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }

    for (let i = data.length; i < MAX_PARTICLES; i++) {
      dummy.position.set(0, -100, 0)
      dummy.scale.setScalar(0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (forceRender) invalidate()
  })

  if (!animated || waypoints.length < 2) return null

  return (
    <instancedMesh
      key={color}
      ref={meshRef}
      args={[geometry, material, MAX_PARTICLES]}
      frustumCulled={false}
      raycast={() => null}
    />
  )
}
