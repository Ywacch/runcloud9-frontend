import type { CanvasNode } from '../../../store/canvasStore'
import { ComponentModel } from '../ComponentModel'
import type { SimulationState } from '../types'

const BASE_CAPACITY = 5000

export class LoadBalancerModel extends ComponentModel {
  constructor(node: CanvasNode) {
    super(node)
  }

  maxCapacityQps(): number {
    const override = Number(this.node.config.nodeCapacityRps)
    if (Number.isFinite(override) && override > 0) return override
    return BASE_CAPACITY
  }

  processRequest(loadQps: number, concurrentConnections: number): SimulationState {
    const capacity = this.maxCapacityQps()
    const utilization = capacity > 0 ? loadQps / capacity : 2
    const baseLatency = 1
    let latency: number
    let errorRate: number
    let isHealthy: boolean

    if (utilization > 1) {
      latency = baseLatency * 5
      errorRate = Math.min(1, utilization - 1)
      isHealthy = false
    } else {
      latency = baseLatency * (1 + utilization * 0.5)
      errorRate = 0
      isHealthy = true
    }

    return {
      cpuUsagePercent: Math.min(100, utilization * 85),
      memoryUsageGb: 0.05 + concurrentConnections * 0.00012 + utilization * 0.05,
      latencyMs: latency,
      errorRate,
      isHealthy,
      currentConnections: concurrentConnections,
      throughputQps: loadQps,
    }
  }
}
