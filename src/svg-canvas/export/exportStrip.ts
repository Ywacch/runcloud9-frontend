/**
 * Rules for nodes removed from an exported SVG (interaction / transient FX).
 * Floor + GridPatterns stay — export matches the live Infinite/Bounded/Off theme.
 */

export type ExportStripTarget = {
  id?: string | null
  getAttribute: (name: string) => string | null
}

export function shouldStripFromExport(el: ExportStripTarget): boolean {
  if (el.id === 'interactionLayer') return true
  if (el.getAttribute('data-export-strip') != null) return true
  if (el.getAttribute('data-health-rim') != null) return true
  if (el.getAttribute('data-traffic-layer') != null) return true
  if (el.getAttribute('data-walkthrough-node-overlay') != null) return true
  return false
}

/** querySelectorAll list used against a live/cloned SVG root. */
export const EXPORT_STRIP_QUERY =
  '#interactionLayer, [data-export-strip], [data-health-rim], [data-traffic-layer], [data-walkthrough-node-overlay]'
