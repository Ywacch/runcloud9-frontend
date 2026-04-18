import type { CanvasNode } from '../../store/canvasStore'
import {
  defaultState,
  type ReplicaBreakdownContext,
  type ReplicaMetrics,
  type SimulationState,
} from './types'

export abstract class ComponentModel {
  readonly node: CanvasNode
  state: SimulationState

  constructor(node: CanvasNode) {
    this.node = node
    this.state = defaultState()
  }

  abstract processRequest(
    loadQps: number,
    concurrentConnections: number
  ): SimulationState

  abstract maxCapacityQps(): number

  /** Optional hit rate for cache-aside absorb edges. */
  get hitRate(): number {
    return 0.85
  }

  /**
   * Per-replica breakdown for horizontally scaled components.
   * Returns null if this model type doesn't support replica decomposition.
   */
  computeReplicaBreakdown(
    _totalQps: number,
    _ctx?: ReplicaBreakdownContext
  ): ReplicaMetrics[] | null {
    return null
  }
}
