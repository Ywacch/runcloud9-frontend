import { useEffect, useMemo, useRef, useState } from 'react'
import { presentWorld } from '../math/projection'
import { useProjectionT } from '../store/projectionStore'
import type { SvgEdge } from '../store/svgTypes'
import {
  particleFade,
  pointOnRoute,
  routeFromWaypoints,
  wrapProgress,
} from '../fx/pathProgress'

/** Match Pixi TrafficLayer constants. */
export const PARTICLES_PER_EDGE = 4
export const PARTICLE_SPEED = 0.004
export const PARTICLE_RADIUS = 3
export const PARTICLE_COLOR = '#00aeef'
export const GLOW_COLOR = '#0077aa'
export const GLOW_RADIUS = 7

type Particle = { progress: number; speed: number }

type TrafficLayerProps = {
  edges: SvgEdge[]
}

function seedParticles(): Particle[] {
  return Array.from({ length: PARTICLES_PER_EDGE }, (_, i) => ({
    progress: i / PARTICLES_PER_EDGE,
    speed: PARTICLE_SPEED * (0.85 + Math.random() * 0.3),
  }))
}

/**
 * Particles along edge waypoints when `trafficEnabled`.
 * Mount after EdgeLayer, before NodeGlyphs. pointer-events: none.
 */
export function TrafficLayer({ edges }: TrafficLayerProps) {
  const enabled = useMemo(
    () => edges.filter((e) => e.trafficEnabled && e.waypoints.length >= 2),
    [edges],
  )
  const [tick, setTick] = useState(0)
  const particlesRef = useRef(new Map<string, Particle[]>())

  useEffect(() => {
    const map = particlesRef.current
    const active = new Set(enabled.map((e) => e.id))
    for (const e of enabled) {
      if (!map.has(e.id)) map.set(e.id, seedParticles())
    }
    for (const id of [...map.keys()]) {
      if (!active.has(id)) map.delete(id)
    }
  }, [enabled])

  useEffect(() => {
    if (enabled.length === 0) return
    let frame = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(3, (now - last) / 16.67)
      last = now
      for (const e of enabled) {
        const particles = particlesRef.current.get(e.id)
        if (!particles) continue
        for (const p of particles) {
          p.progress = wrapProgress(p.progress + p.speed * dt)
        }
      }
      setTick((n) => n + 1)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [enabled])

  const projectionT = useProjectionT()
  if (enabled.length === 0) return null

  return (
    <g data-traffic-layer style={{ pointerEvents: 'none' }} data-tick={tick}>
      {enabled.map((edge) => {
        const route = routeFromWaypoints(
          edge.waypoints.map((p) => presentWorld(p, projectionT)),
        )
        const particles = particlesRef.current.get(edge.id) ?? []
        return (
          <g key={edge.id} data-traffic-edge={edge.id}>
            {particles.map((p, i) => {
              const pos = pointOnRoute(route, p.progress)
              const fade = particleFade(p.progress)
              return (
                <g
                  key={`${edge.id}-${i}`}
                  transform={`translate(${pos.x} ${pos.y})`}
                  opacity={fade}
                >
                  <circle r={GLOW_RADIUS} fill={GLOW_COLOR} opacity={0.15} />
                  <circle r={PARTICLE_RADIUS} fill={PARTICLE_COLOR} opacity={0.9} />
                </g>
              )
            })}
          </g>
        )
      })}
    </g>
  )
}
