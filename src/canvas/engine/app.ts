import 'pixi.js/unsafe-eval'
import { Application } from 'pixi.js'

let _app: Application | null = null

export async function createApp(
  canvas: HTMLCanvasElement,
  resizeTo: HTMLElement,
): Promise<Application> {
  const app = new Application()
  await app.init({
    canvas,
    antialias: true,
    resolution: window.devicePixelRatio ?? 1,
    autoDensity: true,
    backgroundAlpha: 0,
    resizeTo,
  })
  _app = app
  return app
}

export function getApp(): Application {
  if (_app === null) throw new Error('PixiJS app not initialised')
  return _app
}

export function destroyApp(): void {
  if (_app === null) return
  _app.destroy(false, { children: true, texture: false })
  _app = null
}
