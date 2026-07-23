export type Archetype = 'app-server'

/**
 * Design-scene node. `config` holds engine/inspector fields when wired;
 * copy/paste and undo deep-clone it so configs survive duplication.
 */
export type SvgNode = {
  id: string
  archetype: Archetype
  x: number
  y: number
  label: string
  config: Record<string, unknown>
}

export function cloneSvgNode(node: SvgNode): SvgNode {
  return {
    ...node,
    config: structuredClone(node.config),
  }
}

export function emptyConfig(): Record<string, unknown> {
  return {}
}
