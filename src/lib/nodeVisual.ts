import type { CanvasNode } from '../store/canvasStore'

export const NODE_VISUAL: Record<
  CanvasNode['type'],
  { face: string; edge: string; healthEdge: { warning: string; error: string } }
> = {
  load_balancer: {
    face: '#4A90D9',
    edge: '#2C5F8A',
    healthEdge: { warning: '#F0A040', error: '#E05E8A' },
  },
  compute: {
    face: '#8A9BB0',
    edge: '#5A6A7A',
    healthEdge: { warning: '#F0A040', error: '#E05E8A' },
  },
  database: {
    face: '#5C6B7A',
    edge: '#3A4A58',
    healthEdge: { warning: '#F0A040', error: '#E05E8A' },
  },
  cache: {
    face: '#C0392B',
    edge: '#8B1A14',
    healthEdge: { warning: '#F0A040', error: '#E05E8A' },
  },
  message_queue: {
    face: '#E05E8A',
    edge: '#B84A6E',
    healthEdge: { warning: '#F0A040', error: '#E05E8A' },
  },
  worker: {
    face: '#A78BFA',
    edge: '#8B6FD8',
    healthEdge: { warning: '#F0A040', error: '#E05E8A' },
  },
  client: {
    face: '#F39C12',
    edge: '#D68910',
    healthEdge: { warning: '#F0A040', error: '#E05E8A' },
  },
}
