import type { CanvasNode } from '../../../store/canvasStore'
import { ComponentModel } from '../ComponentModel'
import type { SimulationState } from '../types'

export class GenericModel extends ComponentModel {
  constructor(node: CanvasNode) {
    super(node)
  }

  maxCapacityQps(): number {
    const override = Number(this.node.config.nodeCapacityRps)
    if (Number.isFinite(override) && override > 0) return override
    return 10_000
  }

  processRequest(loadQps: number, concurrentConnections: number): SimulationState {
    const utilization = loadQps / 100
    return {
      cpuUsagePercent: Math.min(100, utilization),
      memoryUsageGb: 0,
      latencyMs: 10,
      errorRate: 0,
      isHealthy: true,
      currentConnections: concurrentConnections,
      throughputQps: loadQps,
    }
  }
}
