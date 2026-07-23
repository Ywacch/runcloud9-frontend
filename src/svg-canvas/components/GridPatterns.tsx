/**
 * Cloudcraft-style dual grid (128×74 tiles):
 * - Major: one component footprint (outer box)
 * - Minor: AABB diagonals → 2×2 inner boxes inside each major
 *
 * Design floor stays light (research §1 / §4.3) — theme chrome can darken later.
 */

export function GridPatterns() {
  return (
    <defs>
      <pattern
        id="svgGridPatternMinor"
        width={128}
        height={74}
        patternUnits="userSpaceOnUse"
      >
        <path d="M0 0 L128 74" stroke="#eeeeee" strokeWidth={1} fill="none" />
        <path d="M128 0 L0 74" stroke="#eeeeee" strokeWidth={1} fill="none" />
      </pattern>
      <pattern
        id="svgGridPatternMajor"
        width={128}
        height={74}
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M64 0 L128 37 64 74 0 37 Z"
          stroke="#54626f"
          strokeWidth={1.25}
          fill="none"
        />
      </pattern>
    </defs>
  )
}
