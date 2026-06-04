import { Application } from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import { GRID_COLS, GRID_ROWS, TILE_H, TILE_W } from '../constants'

export function createViewport(app: Application): Viewport {
  const vp = new Viewport({
    screenWidth: app.canvas.width,
    screenHeight: app.canvas.height,
    worldWidth: GRID_COLS * TILE_W * 2,
    worldHeight: GRID_ROWS * TILE_H * 2,
    events: app.renderer.events,
  })

  vp.drag().pinch().wheel().decelerate()
  vp.clampZoom({ minScale: 0.25, maxScale: 3.0 })

  // Default at world origin; template/node fit runs after load.
  vp.moveCenter(0, 0)

  app.stage.addChild(vp)
  return vp
}
