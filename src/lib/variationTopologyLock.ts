export const PROXY_VARIATION_STRATEGIES = ['write-through', 'write-behind'] as const

export type VariationCacheStrategyMode = 'editable' | 'proxy-toggle' | 'frozen'

/** True when the user picked a variation and topology edits are locked. */
export function isVariationTopologyLocked(
  loadedVariationId: string | null | undefined,
): boolean {
  return loadedVariationId != null && loadedVariationId !== ''
}

/** How cache strategy may be changed after a variation load. */
export function variationCacheStrategyMode(
  loadedVariationId: string | null | undefined,
): VariationCacheStrategyMode {
  if (!isVariationTopologyLocked(loadedVariationId)) return 'editable'
  if (loadedVariationId!.includes('proxy')) return 'proxy-toggle'
  return 'frozen'
}

export function filterStrategiesForVariation(
  strategies: string[],
  loadedVariationId: string | null | undefined,
): string[] {
  const mode = variationCacheStrategyMode(loadedVariationId)
  if (mode === 'editable') return strategies
  if (mode === 'proxy-toggle') {
    return strategies.filter((s) =>
      (PROXY_VARIATION_STRATEGIES as readonly string[]).includes(s),
    )
  }
  return strategies
}
