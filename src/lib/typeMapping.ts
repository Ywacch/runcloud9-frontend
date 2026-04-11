import type { CanvasNode } from '../store/canvasStore'

/** Canvas-only types are omitted from deploy payloads before mapping. */
export const canvasToBackend: Record<CanvasNode['type'], string> = {
  load_balancer: 'lb',
  compute: 'app-server',
  database: 'db',
  cache: 'cache',
  message_queue: 'mq',
  worker: 'worker',
  client: 'client',
}

/** Backend `components` map keys → canvas node types we render. */
export const backendComponentToCanvasType: Record<
  string,
  CanvasNode['type'] | undefined
> = {
  lb: 'load_balancer',
  'app-server': 'compute',
  db: 'database',
  cache: 'cache',
  mq: 'message_queue',
  worker: 'worker',
}
