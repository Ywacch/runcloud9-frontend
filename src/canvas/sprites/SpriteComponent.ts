import { Container, Graphics, Sprite, Texture, type Ticker } from 'pixi.js'
import { TILE_W, TILE_H } from '../constants'
import {
  clusteredRowOffset,
  collapsedSlabOy,
  expandedSlotOffset,
} from '../components/replicaSlots'
import {
  DEFAULT_SPRITE_LAYOUT,
  SPRITE_LAYOUT,
  type SpriteLayout,
} from '../config/spriteLayout'
import { spriteFrameForType, type SpriteFrameSpec } from './spriteFrames'
import { getApp } from '../engine/app'
import type { CanvasNode } from '../../editor-core/stores/canvasStore'

export interface SpriteComponentProps {
  nodeType: CanvasNode['type']
  replicaCount: number
  expanded: boolean
}

interface TweenTarget {
  sprite: Sprite
  fromX: number
  fromY: number
  toX: number
  toY: number
}

const FAN_OUT_MS = 200

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function darken(hex: number, factor: number): number {
  const r = Math.floor(((hex >> 16) & 0xff) * factor)
  const g = Math.floor(((hex >> 8) & 0xff) * factor)
  const b = Math.floor((hex & 0xff) * factor)
  return (r << 16) | (g << 8) | b
}

/**
 * Sprite-based body renderer for one canvas component. Mounted inside
 * ComponentContainer (which keeps ownership of interactions, labels, badge,
 * status dot, and overlays). Renders N tinted atlas sprites laid out by the
 * component's replica strategy, and tweens between collapsed and fanned-out
 * slots on the shared PixiJS ticker.
 *
 * Plain PixiJS class — no React hooks; no store access at all (props in).
 */
export class SpriteComponent extends Container {
  private tiles: Sprite[] = []
  private leaders: Graphics | null = null
  private spec: SpriteFrameSpec | null = null
  private props: SpriteComponentProps | null = null
  private tweenFn: ((ticker: Ticker) => void) | null = null

  constructor() {
    super()
    this.eventMode = 'none'
    this.interactiveChildren = false
    this.sortableChildren = true
  }

  /** Local-space offsets (relative to the tile anchor) for each replica slot. */
  private _slotOffsets(
    spec: SpriteFrameSpec,
    count: number,
    expanded: boolean,
  ): { x: number; y: number }[] {
    if (spec.strategy === 'singleton' || count <= 1) {
      return [{ x: 0, y: 0 }]
    }
    if (expanded) {
      return Array.from({ length: count }, (_, i) => expandedSlotOffset(i))
    }
    if (spec.strategy === 'row') {
      return Array.from({ length: count }, (_, i) =>
        clusteredRowOffset(i, count),
      )
    }
    return Array.from({ length: count }, (_, i) => ({
      x: 0,
      y: collapsedSlabOy(i),
    }))
  }

  private _layout(): SpriteLayout {
    if (!this.spec) return DEFAULT_SPRITE_LAYOUT
    return SPRITE_LAYOUT[this.spec.frame] ?? DEFAULT_SPRITE_LAYOUT
  }

  /** Seat position for slot offset `off`: sprite base sits on the tile floor. */
  private _seatPosition(off: { x: number; y: number }): { x: number; y: number } {
    const layout = this._layout()
    return {
      x: TILE_W / 2 + layout.offsetX + off.x,
      y: TILE_H / 2 + layout.offsetY + off.y,
    }
  }

  private _tileTint(spec: SpriteFrameSpec, idx: number, count: number, expanded: boolean): number {
    if (expanded) {
      return idx === 0 ? spec.tint : darken(spec.tint, 1 - idx * 0.08)
    }
    // Collapsed stack: top tier brightest, lower shelves darker for depth.
    return darken(spec.tint, 1 - (count - 1 - idx) * 0.12)
  }

  update(props: SpriteComponentProps): void {
    const spec = spriteFrameForType(props.nodeType)
    if (!spec) {
      this._clear()
      this.props = props
      this.spec = null
      return
    }

    const typeChanged = this.spec?.frame !== spec.frame
    const count =
      spec.strategy === 'singleton'
        ? 1
        : Math.max(1, Math.floor(props.replicaCount))
    const countChanged = this.tiles.length !== count
    const expandedChanged =
      this.props !== null && this.props.expanded !== props.expanded

    const prevProps = this.props
    this.spec = spec
    this.props = props

    if (typeChanged || countChanged) {
      this._stopTween()
      this._clear()
      const layout = this._layout()
      const offsets = this._slotOffsets(spec, count, props.expanded)
      for (let i = 0; i < count; i++) {
        const sprite = new Sprite(Texture.from(spec.frame))
        sprite.eventMode = 'none'
        sprite.anchor.set(layout.anchor.x, layout.anchor.y)
        sprite.scale.set(layout.scale)
        sprite.tint = this._tileTint(spec, i, count, props.expanded)
        const seat = this._seatPosition(offsets[i])
        sprite.position.set(seat.x, seat.y)
        sprite.zIndex = seat.y
        this.tiles.push(sprite)
        this.addChild(sprite)
      }
      this._syncLeaders(count, props.expanded)
      return
    }

    if (expandedChanged && prevProps) {
      const offsets = this._slotOffsets(spec, count, props.expanded)
      const targets: TweenTarget[] = this.tiles.map((sprite, i) => {
        const seat = this._seatPosition(offsets[i])
        return {
          sprite,
          fromX: sprite.position.x,
          fromY: sprite.position.y,
          toX: seat.x,
          toY: seat.y,
        }
      })
      this.tiles.forEach((sprite, i) => {
        sprite.tint = this._tileTint(spec, i, count, props.expanded)
      })
      // Leaders appear only once the fan-out settles (and clear immediately on collapse).
      this._syncLeaders(count, false)
      this._startTween(targets, () => {
        this._syncLeaders(count, this.props?.expanded ?? false)
      })
    }
  }

  private _syncLeaders(count: number, expanded: boolean): void {
    if (this.leaders) {
      this.removeChild(this.leaders)
      this.leaders.destroy()
      this.leaders = null
    }
    if (!expanded || count <= 1) return

    const g = new Graphics()
    g.eventMode = 'none'
    g.zIndex = -100000
    const primary = expandedSlotOffset(0)
    const px = primary.x + TILE_W / 2
    const py = primary.y + TILE_H / 2
    for (let i = 1; i < count; i++) {
      const off = expandedSlotOffset(i)
      const sx = off.x + TILE_W / 2
      const sy = off.y + TILE_H / 2
      const segs = 8
      for (let s = 0; s < segs; s += 2) {
        const t0 = s / segs
        const t1 = Math.min((s + 1) / segs, 1)
        g.moveTo(sx + (px - sx) * t0, sy + (py - sy) * t0)
          .lineTo(sx + (px - sx) * t1, sy + (py - sy) * t1)
          .stroke({ color: 0x9ca3af, width: 1, alpha: 0.45 })
      }
    }
    this.leaders = g
    this.addChild(g)
  }

  private _startTween(targets: TweenTarget[], onComplete?: () => void): void {
    this._stopTween()
    const start = performance.now()
    const fn = (): void => {
      const t = Math.min((performance.now() - start) / FAN_OUT_MS, 1)
      const e = easeOutCubic(t)
      for (const target of targets) {
        target.sprite.position.set(
          target.fromX + (target.toX - target.fromX) * e,
          target.fromY + (target.toY - target.fromY) * e,
        )
        target.sprite.zIndex = target.sprite.position.y
      }
      if (t >= 1) {
        this._stopTween()
        onComplete?.()
      }
    }
    this.tweenFn = fn
    getApp().ticker.add(fn)
  }

  private _stopTween(): void {
    if (!this.tweenFn) return
    getApp().ticker.remove(this.tweenFn)
    this.tweenFn = null
  }

  private _clear(): void {
    for (const sprite of this.tiles) {
      this.removeChild(sprite)
      sprite.destroy()
    }
    this.tiles = []
    if (this.leaders) {
      this.removeChild(this.leaders)
      this.leaders.destroy()
      this.leaders = null
    }
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this._stopTween()
    super.destroy(options ?? { children: true })
  }
}
