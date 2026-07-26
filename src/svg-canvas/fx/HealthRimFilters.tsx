import {
  HEALTH_RIM_FILTER_IDS,
  healthRimFloodColor,
  type HealthRimFilterKey,
} from './healthRimFilter'

const RIM_KEYS = Object.keys(HEALTH_RIM_FILTER_IDS) as HealthRimFilterKey[]

/**
 * One shared silhouette outline filter per health state.
 * Dilates SourceAlpha, floods health color (+ dark understroke + soft glow),
 * then punches out the original alpha so only the rim remains.
 */
function SilhouetteRimFilter({
  id,
  color,
}: {
  id: string
  color: string
}) {
  return (
    <filter
      id={id}
      x="-30%"
      y="-30%"
      width="160%"
      height="160%"
      colorInterpolationFilters="sRGB"
    >
      <feMorphology
        in="SourceAlpha"
        operator="dilate"
        radius={3}
        result="dilated"
      />
      <feMorphology
        in="SourceAlpha"
        operator="dilate"
        radius={5}
        result="glowDilated"
      />

      <feFlood floodColor="#0a0a0a" floodOpacity={0.45} result="darkFlood" />
      <feComposite
        in="darkFlood"
        in2="dilated"
        operator="in"
        result="darkFill"
      />
      <feComposite
        in="darkFill"
        in2="SourceAlpha"
        operator="out"
        result="darkRim"
      />

      <feFlood floodColor={color} floodOpacity={1} result="colorFlood" />
      <feComposite
        in="colorFlood"
        in2="dilated"
        operator="in"
        result="colorFill"
      />
      <feComposite
        in="colorFill"
        in2="SourceAlpha"
        operator="out"
        result="colorRim"
      />

      <feFlood floodColor={color} floodOpacity={0.35} result="glowFlood" />
      <feComposite
        in="glowFlood"
        in2="glowDilated"
        operator="in"
        result="glowFill"
      />
      <feComposite
        in="glowFill"
        in2="SourceAlpha"
        operator="out"
        result="glowRim"
      />

      <feMerge>
        <feMergeNode in="glowRim" />
        <feMergeNode in="darkRim" />
        <feMergeNode in="colorRim" />
      </feMerge>
    </filter>
  )
}

/** Mount once inside the root SVG `<defs>` tree (next to grid patterns). */
export function HealthRimFilters() {
  return (
    <defs>
      {RIM_KEYS.map((key) => (
        <SilhouetteRimFilter
          key={key}
          id={HEALTH_RIM_FILTER_IDS[key]}
          color={healthRimFloodColor(key)}
        />
      ))}
    </defs>
  )
}
