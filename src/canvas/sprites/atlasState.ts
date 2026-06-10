/**
 * Runtime readiness flag for the component spritesheet. Set by CanvasApp after
 * `Assets.load('/spritesheets/components.json')` resolves with all expected
 * frames; checked by ComponentContainer before choosing the sprite body path.
 * Plain module state — no React, no stores.
 */
let ready = false

export function markAtlasReady(): void {
  ready = true
}

export function isAtlasReady(): boolean {
  return ready
}
