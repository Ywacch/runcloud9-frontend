import { Graphics } from 'pixi.js'
import type { Viewport } from 'pixi-viewport'
import { GRID_COLS, GRID_ROWS, isoToScreen } from '../constants'

/** Grid is centered on world origin so default camera and node fit feel balanced. */
const GRID_ORIGIN = Math.floor(GRID_COLS / 2)

export class GridLayer extends Graphics {
  private readonly viewport: Viewport

  constructor(viewport: Viewport) {
    super()
    this.viewport = viewport
    this.drawGrid()
    this.viewport.on('moved', this.drawGrid)
    this.viewport.on('zoomed', this.drawGrid)
  }

  private drawGrid = (): void => {
    this.clear()
    this.setStrokeStyle({ width: 0.5, color: 0xaaaaaa, alpha: 0.4 })

    for (let col = -GRID_ORIGIN; col < GRID_COLS - GRID_ORIGIN; col++) {
      for (let row = -GRID_ORIGIN; row < GRID_ROWS - GRID_ORIGIN; row++) {
        const top = isoToScreen(col, row)
        const right = isoToScreen(col + 1, row)
        const bottom = isoToScreen(col + 1, row + 1)
        const left = isoToScreen(col, row + 1)

        this.moveTo(top.x, top.y)
        this.lineTo(right.x, right.y)
        this.moveTo(right.x, right.y)
        this.lineTo(bottom.x, bottom.y)
        this.moveTo(bottom.x, bottom.y)
        this.lineTo(left.x, left.y)
        this.moveTo(left.x, left.y)
        this.lineTo(top.x, top.y)
      }
    }

    this.stroke()
  }

  override destroy(options?: Parameters<Graphics['destroy']>[0]): void {
    this.viewport.off('moved', this.drawGrid)
    this.viewport.off('zoomed', this.drawGrid)
    super.destroy(options)
  }
}
