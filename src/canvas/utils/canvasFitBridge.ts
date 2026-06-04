/** Lets Pixi layers request a viewport fit after they have synced. */
let scheduleFit: (() => void) | null = null

export function registerCanvasFitScheduler(fn: () => void): void {
  scheduleFit = fn
}

export function unregisterCanvasFitScheduler(): void {
  scheduleFit = null
}

export function requestCanvasFit(): void {
  scheduleFit?.()
}
