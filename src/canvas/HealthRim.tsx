import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

type HealthRimState = 'idle' | 'healthy' | 'warning' | 'error'

const RIM_CONFIG: Record<
  Exclude<HealthRimState, 'idle'>,
  { color: string; pulseSpeed: number }
> = {
  healthy: { color: '#22c55e', pulseSpeed: 0 },
  warning: { color: '#f59e0b', pulseSpeed: 1.0 },
  error: { color: '#ef4444', pulseSpeed: 2.2 },
}

export function HealthRim({
  health,
  bounds,
}: {
  health: HealthRimState
  bounds: { w: number; h: number; d: number }
}) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  const config = health === 'idle' ? null : RIM_CONFIG[health]
  const pulseSpeed = config?.pulseSpeed ?? 0

  useFrame(({ clock }) => {
    const m = matRef.current
    if (!m || !config) return
    if (pulseSpeed === 0) {
      m.opacity = 0.35
    } else {
      m.opacity =
        0.25 +
        0.4 * Math.abs(Math.sin(clock.getElapsedTime() * Math.PI * pulseSpeed))
    }
  })

  if (!config) return null

  return (
    <mesh
      scale={[
        bounds.w * 0.54 * 1.08,
        bounds.h * 1.12,
        bounds.d * 0.54 * 1.08,
      ]}
      castShadow={false}
      receiveShadow={false}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        color={config.color}
        side={THREE.BackSide}
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </mesh>
  )
}
