/// <reference lib="webworker" />
import type { CanvasEdge, CanvasNode } from '../../store/canvasStore'
import { SimulationEngine } from './SimulationEngine'
import type { WorkloadProfile } from './workload'
import type { SimulationTickResult } from './types'

export type SimulationWorkerInMessage =
  | {
      type: 'init'
      nodes: CanvasNode[]
      edges: CanvasEdge[]
      workloadProfile?: WorkloadProfile
    }
  | {
      type: 'reinit'
      nodes: CanvasNode[]
      edges: CanvasEdge[]
    }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'setLoadFactor'; value: number }
  | { type: 'setSimulationSpeed'; value: number }

export type SimulationWorkerOutMessage = { type: 'tick' } & SimulationTickResult

/** Fixed simulated timestep per tick (wall-clock interval scales with speed). */
const STEP_MS = 1000 / 60

let engine: SimulationEngine | null = null
let intervalId: ReturnType<typeof setInterval> | null = null
let paused = false
/** >1 runs more ticks per real second (faster simulated time). */
let simulationSpeed = 1

function clearLoop(): void {
  if (intervalId != null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

function wallIntervalMs(): number {
  return Math.max(8, STEP_MS / simulationSpeed)
}

function scheduleLoop(): void {
  clearLoop()
  if (!engine || paused) return
  intervalId = setInterval(tick, wallIntervalMs())
}

function tick(): void {
  if (!engine || paused) return
  const result = engine.step(STEP_MS)
  const msg: SimulationWorkerOutMessage = {
    type: 'tick',
    ...result,
  }
  self.postMessage(msg)
}

self.onmessage = (ev: MessageEvent<SimulationWorkerInMessage>) => {
  const data = ev.data
  switch (data.type) {
    case 'init':
      clearLoop()
      engine = new SimulationEngine(
        data.nodes,
        data.edges,
        data.workloadProfile
      )
      paused = true
      break
    case 'reinit':
      if (engine) engine.reinit(data.nodes, data.edges)
      break
    case 'start':
      if (!engine) return
      paused = false
      scheduleLoop()
      break
    case 'pause':
      paused = true
      clearLoop()
      break
    case 'resume':
      if (!engine) return
      paused = false
      scheduleLoop()
      break
    case 'setLoadFactor':
      if (engine) engine.setLoadFactor(data.value)
      break
    case 'setSimulationSpeed':
      simulationSpeed = Math.max(0.25, Math.min(4, data.value))
      if (!paused && engine) scheduleLoop()
      break
    default:
      break
  }
}

export type {}
