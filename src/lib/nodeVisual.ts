import type { CanvasNode } from '../store/canvasStore'

export const BLUEPRINT_EDGE = '#333333'

export const NODE_VISUAL: Record<
  CanvasNode['type'],
  { face: string; edge: string; healthEdge: { warning: string; error: string } }
> = {
  load_balancer: {
    face: '#4A90D9',
    edge: BLUEPRINT_EDGE,
    healthEdge: { warning: '#F0A040', error: '#E05E8A' },
  },
  compute: {
    face: '#8A9BB0',
    edge: BLUEPRINT_EDGE,
    healthEdge: { warning: '#F0A040', error: '#E05E8A' },
  },
  database: {
    face: '#5C6B7A',
    edge: BLUEPRINT_EDGE,
    healthEdge: { warning: '#F0A040', error: '#E05E8A' },
  },
  cache: {
    face: '#C0392B',
    edge: BLUEPRINT_EDGE,
    healthEdge: { warning: '#F0A040', error: '#E05E8A' },
  },
  message_queue: {
    face: '#E05E8A',
    edge: BLUEPRINT_EDGE,
    healthEdge: { warning: '#F0A040', error: '#E05E8A' },
  },
  worker: {
    face: '#A78BFA',
    edge: BLUEPRINT_EDGE,
    healthEdge: { warning: '#F0A040', error: '#E05E8A' },
  },
  client: {
    face: '#F39C12',
    edge: BLUEPRINT_EDGE,
    healthEdge: { warning: '#F0A040', error: '#E05E8A' },
  },
}
