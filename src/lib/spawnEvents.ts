import type { CanvasNode } from '../store/canvasStore'

export const SPAWN_AT_SCREEN = 'runcloud9:spawn-at-screen'
export const RESET_CAMERA = 'runcloud9:reset-camera'

export type SpawnAtScreenDetail = {
  clientX: number
  clientY: number
  nodeType: CanvasNode['type']
}

export function dispatchSpawnAtScreen(detail: SpawnAtScreenDetail): void {
  window.dispatchEvent(new CustomEvent(SPAWN_AT_SCREEN, { detail }))
}

export function dispatchResetCamera(): void {
  window.dispatchEvent(new CustomEvent(RESET_CAMERA))
}
