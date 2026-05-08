import type { CanvasEdge, CanvasNode } from '../store/canvasStore'

/**
 * Default protocol when the user connects two canvas nodes.
 * Backend/templates may still specify their own protocol via presets.
 */
export function defaultEdgeProtocol(
  sourceType: CanvasNode['type'],
  targetType: CanvasNode['type']
): CanvasEdge['protocol'] {
  if (
    targetType === 'database' ||
    targetType === 'cache' ||
    targetType === 'message_queue'
  ) {
    return 'tcp'
  }
  if (sourceType === 'message_queue' && targetType === 'worker') {
    return 'tcp'
  }
  return 'http'
}
