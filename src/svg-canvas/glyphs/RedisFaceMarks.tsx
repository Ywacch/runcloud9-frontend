/**
 * Redis top-face badge paths measured from Cloudcraft export
 * `Caching Cluster Architecture (1).svg`.
 *
 * Export uses absolute coords with bottom-slab top-face left tip at
 * (-426.037, 221.368). Our brand body anchors that tip at (0, 0), so we
 * translate by (426.037, -221.368) and paint the same paths.
 *
 * Not a stamped logo image — native iso geometry (circle via iso matrix,
 * star/triangle path, small 3D wedge accents).
 */

/** Cloudcraft bottom-slab top-face left tip → our (0,0). */
const CC_TO_LOCAL = 'translate(426.037 -221.368)'

/** Iso plane → screen (matches export matrix on the white disc). */
const ISO_CIRCLE_MATRIX = 'matrix(.86532 .50122 -.86532 .50122 0 0)'

export function RedisFaceMarks() {
  return (
    <g transform={CC_TO_LOCAL} style={{ pointerEvents: 'none' }} data-redis-face-marks>
      {/* White disc projected onto the top face */}
      <circle
        cx={-61.433}
        cy={391.153}
        r={9.763}
        fill="#ffffff"
        transform={ISO_CIRCLE_MATRIX}
      />
      {/* Spark + triangle */}
      <path
        fill="#ffffff"
        d="m-367.29 159.13-3.235-6.18-10.624-1.96 9.148-3.692-.066-6.458 8.89 3.899 10.583-2.032-3.654 6.101 6.607 5.203-11.148-.127zm8.295 34.915-19.486-11.437 26.842-4.057z"
      />
      {/* Small isometric wedge accents on the top-right of the lid */}
      <path
        fill="#821c17"
        d="m-332.057 176.963-17.064-9.884 17.064-9.883 17.064 9.883z"
      />
      <path
        fill="#561310"
        fillRule="evenodd"
        d="M-332.056 157.195v19.768l17.064-9.884z"
      />
    </g>
  )
}
