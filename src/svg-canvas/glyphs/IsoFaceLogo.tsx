import { useId } from 'react'
import { HALF_H, HALF_W } from '../math/iso'
import { logoDataUrl } from '../skins/logos'
import type { FaceShape } from './spriteMetrics'

/** Cloudcraft 2:1 iso: vertical scale of top-face vs width. */
const ISO_K = HALF_H / HALF_W

export type IsoFaceLogoProps = {
  /** Center of the isometric top face (tip-local coords). */
  cx: number
  cy: number
  /** Full width of the logo plate on the top face (px). */
  size: number
  logoId: string | null
  /** Top-face geometry: box tops use diamond shear; drums use ellipse squash. */
  shape?: FaceShape
  /** Soft light underlay for contrast on greys. Off for brand-colored bodies (Redis). */
  plate?: boolean
  /**
   * Also stamp a sheared mark on the left vertical face (procedural bodies).
   */
  leftFace?: { cx: number; cy: number; width: number; height: number } | null
}

/**
 * Project a logo onto the isometric top face so it reads as painted on
 * the surface (Quiver-style slap), not a floating billboard chip.
 */
export function IsoFaceLogo({
  cx,
  cy,
  size,
  logoId,
  shape = 'diamond',
  plate = true,
  leftFace = null,
}: IsoFaceLogoProps) {
  const rawId = useId().replace(/:/g, '')
  const href = logoId ? logoDataUrl(logoId) : null
  if (!href) return null

  const clipId = `face-clip-${rawId}`
  const s = size / 2

  return (
    <g style={{ pointerEvents: 'none' }} data-face-logo={logoId}>
      <defs>
        {shape === 'ellipse' ? (
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <ellipse cx={cx} cy={cy} rx={s} ry={s * ISO_K} />
          </clipPath>
        ) : (
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            {/* Iso diamond: left / top / right / bottom tips */}
            <polygon
              points={`${cx - s},${cy} ${cx},${cy - s * ISO_K} ${cx + s},${cy} ${cx},${cy + s * ISO_K}`}
            />
          </clipPath>
        )}
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {/* Soft plate so marks read on tinted greys */}
        {plate && shape === 'ellipse' ? (
          <ellipse
            cx={cx}
            cy={cy}
            rx={s * 0.98}
            ry={s * ISO_K * 0.98}
            fill="#f4f4f5"
            opacity={0.55}
          />
        ) : null}
        {plate && shape === 'diamond' ? (
          <polygon
            points={`${cx - s * 0.98},${cy} ${cx},${cy - s * ISO_K * 0.98} ${cx + s * 0.98},${cy} ${cx},${cy + s * ISO_K * 0.98}`}
            fill="#f4f4f5"
            opacity={0.45}
          />
        ) : null}

        {shape === 'ellipse' ? (
          // Drum top: axis-aligned squash into the iso ellipse (matches Quiver slap).
          <g transform={`translate(${cx} ${cy}) scale(${s * 0.9} ${s * ISO_K * 0.9})`}>
            <image
              href={href}
              x={-0.5}
              y={-0.5}
              width={1}
              height={1}
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        ) : (
          // Box top: shear UV square onto the diamond so edges track the face.
          <g transform={`matrix(${s * 0.9},${s * ISO_K * 0.9},${-s * 0.9},${s * ISO_K * 0.9},${cx},${cy})`}>
            <image
              href={href}
              x={-0.5}
              y={-0.5}
              width={1}
              height={1}
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        )}
      </g>

      {leftFace ? (
        <LeftFaceLogo
          href={href}
          cx={leftFace.cx}
          cy={leftFace.cy}
          width={leftFace.width}
          height={leftFace.height}
        />
      ) : null}
    </g>
  )
}

/** Shear a logo onto an iso left wall (parallelogram). */
function LeftFaceLogo({
  href,
  cx,
  cy,
  width,
  height,
}: {
  href: string
  cx: number
  cy: number
  width: number
  height: number
}) {
  const sx = width / 2
  const sy = height / 2
  const shear = HALF_H / HALF_W
  const matrix = `${sx},${sx * shear},0,${sy},${cx},${cy}`
  return (
    <g transform={`matrix(${matrix})`} opacity={0.9}>
      <rect x={-0.5} y={-0.5} width={1} height={1} fill="#f4f4f5" opacity={0.35} />
      <image
        href={href}
        x={-0.42}
        y={-0.42}
        width={0.84}
        height={0.84}
        preserveAspectRatio="xMidYMid meet"
      />
    </g>
  )
}
