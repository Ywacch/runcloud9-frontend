import type { WsDeploymentMetrics } from './wsMetricsTypes'

/** Parse a metrics stream data line (WebSocket or SSE). */
export function parseMetricsStreamPayload(data: string): WsDeploymentMetrics {
  return JSON.parse(data) as WsDeploymentMetrics
}