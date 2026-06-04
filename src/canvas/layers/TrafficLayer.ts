import { Container, Graphics, type Ticker } from 'pixi.js'
import {
  useCanvasStore,
  type CanvasEdge,
  type CanvasNode,
} from '../../editor-core/stores/canvasStore'
import { getApp } from '../engine/app'
import { getConnectionPoint } from '../utils/connectionPoint'

const PARTICLES_PER_EDGE = 4
const PARTICLE_SPEED = 0.004
const PARTICLE_RADIUS = 3
const PARTICLE_COLOR = 0xc4b5fd
const GLOW_COLOR = 0x7c6fcd
const GLOW_RADIUS = 7

interface Particle {
  gfx: Graphics
  progress: number
  speed: number
}

interface EdgeParticles {
  edgeId: string
  particles: Particle[]
  sx: number
  sy: number
  tx: number
  ty: number
}

function createParticleGfx(): Graphics {
  const gfx = new Graphics()
  gfx.circle(0, 0, GLOW_RADIUS).fill({ color: GLOW_COLOR, alpha: 0.15 })
  gfx.circle(0, 0, PARTICLE_RADIUS).fill({ color: PARTICLE_COLOR, alpha: 0.9 })
  gfx.eventMode = 'none'
  return gfx
}

export class TrafficLayer extends Container {
  private readonly edgeParticles = new Map<string, EdgeParticles>()
  private readonly unsubscribe: () => void
  private readonly tickerFn: (ticker: Ticker) => void

  constructor() {
    super()
    this.eventMode = 'none'
    this.interactiveChildren = false

    let prevEdges = useCanvasStore.getState().edges
    let prevNodes = useCanvasStore.getState().nodes

    this.unsubscribe = useCanvasStore.subscribe((state) => {
      if (state.edges !== prevEdges || state.nodes !== prevNodes) {
        prevEdges = state.edges
        prevNodes = state.nodes
        this.syncEdges(state.nodes, state.edges)
      }
    })

    this.tickerFn = (ticker: Ticker) => this.tick(ticker.deltaTime)
    getApp().ticker.add(this.tickerFn)

    const initial = useCanvasStore.getState()
    this.syncEdges(initial.nodes, initial.edges)
  }

  private syncEdges(
    nodes: Record<string, CanvasNode>,
    edges: Record<string, CanvasEdge>,
  ): void {
    const activeIds = new Set<string>()

    for (const edge of Object.values(edges)) {
      if (!edge.animated) continue
      const src = nodes[edge.sourceId]
      const tgt = nodes[edge.targetId]
      if (!src || !tgt) continue

      activeIds.add(edge.id)
      const sp = getConnectionPoint(src)
      const tp = getConnectionPoint(tgt)

      const existing = this.edgeParticles.get(edge.id)
      if (existing) {
        existing.sx = sp.x
        existing.sy = sp.y
        existing.tx = tp.x
        existing.ty = tp.y
      } else {
        const particles: Particle[] = []
        for (let i = 0; i < PARTICLES_PER_EDGE; i++) {
          const gfx = createParticleGfx()
          this.addChild(gfx)
          particles.push({
            gfx,
            progress: i / PARTICLES_PER_EDGE,
            speed: PARTICLE_SPEED * (0.85 + Math.random() * 0.3),
          })
        }
        this.edgeParticles.set(edge.id, {
          edgeId: edge.id,
          particles,
          sx: sp.x,
          sy: sp.y,
          tx: tp.x,
          ty: tp.y,
        })
      }
    }

    for (const [id, ep] of this.edgeParticles) {
      if (!activeIds.has(id)) {
        for (const p of ep.particles) {
          this.removeChild(p.gfx)
          p.gfx.destroy()
        }
        this.edgeParticles.delete(id)
      }
    }
  }

  private tick(deltaTime: number): void {
    for (const ep of this.edgeParticles.values()) {
      for (const particle of ep.particles) {
        particle.progress += particle.speed * deltaTime
        if (particle.progress >= 1) particle.progress -= 1

        particle.gfx.x = ep.sx + (ep.tx - ep.sx) * particle.progress
        particle.gfx.y = ep.sy + (ep.ty - ep.sy) * particle.progress
        particle.gfx.visible = true

        const fade = Math.min(
          particle.progress * 8,
          1,
          (1 - particle.progress) * 8,
        )
        particle.gfx.alpha = fade
      }
    }
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    getApp().ticker.remove(this.tickerFn)
    this.unsubscribe()
    for (const ep of this.edgeParticles.values()) {
      for (const p of ep.particles) {
        p.gfx.destroy()
      }
    }
    this.edgeParticles.clear()
    if (options) {
      super.destroy(options)
    } else {
      super.destroy({ children: true })
    }
  }
}
