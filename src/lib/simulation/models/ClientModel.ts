import type { CanvasNode } from '../../../store/canvasStore'
import { ComponentModel } from '../ComponentModel'
import type { SimulationState } from '../types'

export class ClientModel extends ComponentModel {
  constructor(node: CanvasNode) {
    super(node)
  }

  maxCapacityQps(): number {
    return 1_000_000
  }

  processRequest(loadQps: number, concurrentConnections: number): SimulationState {
    return {
      cpuUsagePercent: Math.min(100, loadQps / 200),
      memoryUsageGb: 0.1,
      latencyMs: 2,
      errorRate: 0,
      isHealthy: true,
      currentConnections: concurrentConnections,
      throughputQps: loadQps,
    }
  }
}
