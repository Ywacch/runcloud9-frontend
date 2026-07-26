import { useEffect, useState } from 'react'
import {
  isWalkthroughRunning,
  walkthroughNodeRole,
} from '../../canvas/utils/walkthroughVisual'
import { useCanvasStore } from '../../editor-core/stores/canvasStore'
import type { SvgNode } from '../store/svgTypes'
import {
  WALKTHROUGH_CYAN,
  walkthroughGlyphArtBox,
} from '../fx/walkthroughChrome'

/** Match Pixi `_startWalkthroughPulse`: `0.45 + sin(t*0.004)*0.15`. */
function useActivePulse(enabled: boolean): number {
  const [pulse, setPulse] = useState(0.45)
  useEffect(() => {
    if (!enabled) return
    let frame = 0
    const tick = () => {
      setPulse(0.45 + Math.sin(Date.now() * 0.004) * 0.15)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [enabled])
  return pulse
}

function ActiveFrame({
  box,
  pulse,
}: {
  box: { x: number; y: number; w: number; h: number }
  pulse: number
}) {
  const glow = 0.35 + pulse * 0.4
  const outer = 0.08 + pulse * 0.12
  return (
    <>
      <rect
        x={box.x - 2}
        y={box.y - 2}
        width={box.w + 4}
        height={box.h + 4}
        rx={8}
        ry={8}
        fill="none"
        stroke={WALKTHROUGH_CYAN}
        strokeWidth={6}
        opacity={outer}
        style={{ pointerEvents: 'none' }}
      />
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={6}
        ry={6}
        fill="none"
        stroke={WALKTHROUGH_CYAN}
        strokeWidth={3}
        opacity={glow}
        style={{ pointerEvents: 'none' }}
      />
    </>
  )
}

function VisitedFrame({
  box,
}: {
  box: { x: number; y: number; w: number; h: number }
}) {
  return (
    <rect
      x={box.x}
      y={box.y}
      width={box.w}
      height={box.h}
      rx={6}
      ry={6}
      fill="none"
      stroke={WALKTHROUGH_CYAN}
      strokeWidth={2}
      opacity={0.35}
      style={{ pointerEvents: 'none' }}
    />
  )
}

type WalkthroughNodeOverlayProps = {
  nodes: SvgNode[]
  /** Live drag positions keyed by id. */
  liveById?: Map<string, { x: number; y: number }>
}

/**
 * Cyan AABB frames for walkthrough active/visited nodes.
 * Opacity dimming of glyphs/zones is applied by the host via walkthroughNodeAlpha.
 */
export function WalkthroughNodeOverlay({
  nodes,
  liveById,
}: WalkthroughNodeOverlayProps) {
  const mode = useCanvasStore((s) => s.mode)
  const activeNodeId = useCanvasStore((s) => s.walkthroughActiveNodeId)
  const visitedNodeIds = useCanvasStore((s) => s.walkthroughVisitedNodeIds)
  const participatingNodeIds = useCanvasStore(
    (s) => s.walkthroughParticipatingNodeIds,
  )

  const state = useCanvasStore.getState()
  const running = isWalkthroughRunning(state)
  const pulse = useActivePulse(running && activeNodeId != null)

  // Touch subscribed fields so React keeps this render tied to walkthrough steps.
  void mode
  void visitedNodeIds
  void participatingNodeIds

  if (!running) return null

  return (
    <g data-walkthrough-node-overlay style={{ pointerEvents: 'none' }}>
      {nodes.map((node) => {
        const role = walkthroughNodeRole(node.id, state)
        if (role !== 'active' && role !== 'visited') return null
        const live = liveById?.get(node.id)
        const placed = live
          ? { ...node, x: live.x, y: live.y }
          : node
        const box = walkthroughGlyphArtBox(placed)
        return (
          <g key={node.id} data-walkthrough-role={role}>
            {role === 'active' ? (
              <ActiveFrame box={box} pulse={pulse} />
            ) : (
              <VisitedFrame box={box} />
            )}
          </g>
        )
      })}
    </g>
  )
}
