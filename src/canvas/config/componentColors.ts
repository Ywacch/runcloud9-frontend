import type { CanvasNode } from '../../editor-core/stores/canvasStore'

type ComponentColorConfig = {
  top: number
  left: number
  right: number
  sideHeight: number
}

export const COMPONENT_COLORS: Record<CanvasNode['type'], ComponentColorConfig> = {
  load_balancer: { top: 0x7eb8f8, left: 0x4a8fd0, right: 0x2a5fa0, sideHeight: 28 },
  compute: { top: 0xb0bcc8, left: 0x809098, right: 0x506070, sideHeight: 36 },
  database: { top: 0x8090a8, left: 0x607080, right: 0x405060, sideHeight: 48 },
  cache: { top: 0xf07878, left: 0xc04040, right: 0x902020, sideHeight: 20 },
  message_queue: { top: 0xb07ee8, left: 0x834ac9, right: 0x5a2a99, sideHeight: 32 },
  worker: { top: 0xc898f0, left: 0x9668c8, right: 0x6840a0, sideHeight: 36 },
  client: { top: 0x78b0f0, left: 0x4878c0, right: 0x285090, sideHeight: 24 },
}
