import type { CanvasNode } from '../store/canvasStore'

export const NODE_VISUAL: Record<
  CanvasNode['type'],
  { face: string; edge: string }
> = {
  load_balancer: { face: '#4A90D9', edge: '#2C5F8A' },
  compute: { face: '#8A9BB0', edge: '#5A6A7A' },
  database: { face: '#5C6B7A', edge: '#3A4A58' },
  cache: { face: '#C0392B', edge: '#8B1A14' },
  message_queue: { face: '#E05E8A', edge: '#B84A6E' },
  worker: { face: '#A78BFA', edge: '#8B6FD8' },
  client: { face: '#F39C12', edge: '#D68910' },
}
