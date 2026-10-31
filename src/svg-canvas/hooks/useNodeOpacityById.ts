import { useMemo } from 'react'
import type { TemplatePresetMode } from '../../lib/templatePresetMode'
import { engineerLockedNodeOpacity } from '../../lib/engineerLockedVisual'
import { useEnginePreviewStore } from '../../editor-core/stores/enginePreviewStore'
import { archetypeToCanvasType } from '../bridge/canvasSvgAdapter'
import type { SvgNode } from '../store/svgTypes'

/** Combines walkthrough dimming with Explorer full-mode Engineer mute. */
export function useNodeOpacityById(opts: {
  nodes: SvgNode[]
  walkthroughOpacityById: Map<string, number> | null
  isFreeUser: boolean
  templatePresetMode: TemplatePresetMode | null
}): Map<string, number> | null {
  const { nodes, walkthroughOpacityById, isFreeUser, templatePresetMode } = opts
  const hiddenIds = useEnginePreviewStore((s) => s.preview?.removeNodeIds)
  return useMemo(() => {
    const hidden = new Set(hiddenIds ?? [])
    const map = new Map<string, number>()
    let anyMuted = false
    for (const n of nodes) {
      const walk = walkthroughOpacityById?.get(n.id) ?? 1
      const locked = engineerLockedNodeOpacity({
        nodeType: archetypeToCanvasType(n.archetype),
        isFreeUser,
        mode: templatePresetMode,
      })
      const preview = hidden.has(n.id) ? 0.15 : 1
      const opacity = walk * locked * preview
      if (opacity !== 1) anyMuted = true
      map.set(n.id, opacity)
    }
    return anyMuted || walkthroughOpacityById || hidden.size > 0 ? map : null
  }, [nodes, walkthroughOpacityById, isFreeUser, templatePresetMode, hiddenIds])
}
