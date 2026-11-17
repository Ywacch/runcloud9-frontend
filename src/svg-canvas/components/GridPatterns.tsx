import type { FloorThemeTokens } from '../theme/floorTheme'

/**
 * Cloudcraft-style dual grid (128×74 tiles):
 * - Major: one component footprint (outer box)
 * - Minor: AABB diagonals → 2×2 inner boxes inside each major
 *
 * Stroke colors come from the canvas floor theme (dark default / light option).
 */

type Props = {
  theme: FloorThemeTokens
}

export function GridPatterns({ theme }: Props) {
  return (
    <defs>
      <pattern
        id="svgGridPatternMinor"
        width={128}
        height={74}
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M0 0 L128 74"
          stroke={theme.gridMinor}
          strokeWidth={1}
          fill="none"
        />
        <path
          d="M128 0 L0 74"
          stroke={theme.gridMinor}
          strokeWidth={1}
          fill="none"
        />
      </pattern>
      <pattern
        id="svgGridPatternMajor"
        width={128}
        height={74}
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M64 0 L128 37 64 74 0 37 Z"
          stroke={theme.gridMajor}
          strokeWidth={1.25}
          fill="none"
        />
      </pattern>
      <pattern
        id="svgGridPatternSquareMinor"
        width={128}
        height={128}
        patternUnits="userSpaceOnUse"
      >
        <path d="M64 0 L64 128" stroke={theme.gridMinor} strokeWidth={1} fill="none" />
        <path d="M0 64 L128 64" stroke={theme.gridMinor} strokeWidth={1} fill="none" />
      </pattern>
      <pattern
        id="svgGridPatternSquareMajor"
        width={128}
        height={128}
        patternUnits="userSpaceOnUse"
      >
        <path d="M0 0 L128 0 L128 128 L0 128 Z" stroke={theme.gridMajor} strokeWidth={1.25} fill="none" />
      </pattern>
    </defs>
  )
}
