import type { WorldPoint } from '../math/iso'
import chevronSvg from '../assets/connector-chevron.svg?raw'

/** Path `d` from connector-chevron.svg — do not hand-edit; update the SVG file instead. */
export const CONNECTOR_CHEVRON_D =
  'M 0,0 -8.047,4.648 7.242,8.828 3.621,4.414 Z'

/** Degrees: asset tip at (0,0) points along +X; rotate to match segment bearing. */
export const CONNECTOR_CHEVRON_TIP_BEARING_DEG = 0

/** Shaft stops here before the imported chevron (notch depth in asset units). */
export const CONNECTOR_CHEVRON_SHAFT_INSET = 8

export function parseConnectorChevronPath(raw = chevronSvg): string {
  const match = raw.match(/\bd="([^"]+)"/)
  return match?.[1]?.trim() ?? CONNECTOR_CHEVRON_D
}

/** SVG transform: tip at `tip`, opening aligned with incoming segment `from` → `tip`. */
export function connectorChevronTransform(
  tip: WorldPoint,
  from: WorldPoint,
): string {
  const dx = tip.x - from.x
  const dy = tip.y - from.y
  const angleDeg =
    (Math.atan2(dy, dx) * 180) / Math.PI + CONNECTOR_CHEVRON_TIP_BEARING_DEG
  return `translate(${tip.x} ${tip.y}) rotate(${angleDeg})`
}
