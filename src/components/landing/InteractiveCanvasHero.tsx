import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import canvasHeroUrl from '../../assets/canvas-hero.svg'

type TooltipState = {
  /** Role / node name (e.g. Load Balancer, Cache). */
  title: string
  /** Engine / brand line under the title (e.g. Nginx, RabbitMQ). */
  subtitle: string | null
  /** Coords relative to the host wrapper. */
  x: number
  y: number
}

/** Display names for engine / face-logo ids. */
const ENGINE_DISPLAY: Record<string, string> = {
  nginx: 'Nginx',
  go: 'Go',
  gopher: 'Go',
  rabbitmq: 'RabbitMQ',
  redis: 'Redis',
  postgresql: 'PostgreSQL',
  postgres: 'PostgreSQL',
  mongodb: 'MongoDB',
  memcached: 'Memcached',
  kafka: 'Kafka',
  nats: 'NATS',
}

/** Role shown when the node label already is the engine name (e.g. Redis). */
const ARCHETYPE_ROLE: Record<string, string> = {
  cache: 'Cache',
  database: 'Database',
  worker: 'Worker',
  'message-queue': 'Message queue',
  'app-server': 'App server',
  'load-balancer': 'Load balancer',
  client: 'Client',
}

/** Fallback brand when engine is generic / missing and no face logo. */
const ARCHETYPE_BRAND: Record<string, string> = {
  cache: 'redis',
  database: 'postgresql',
  worker: 'go',
  'message-queue': 'rabbitmq',
  'app-server': 'go',
  'load-balancer': 'nginx',
}

function normalizeKey(raw: string | null | undefined): string | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase()
  if (!key || key === 'generic') return null
  return key
}

function displayEngine(key: string): string {
  return ENGINE_DISPLAY[key] ?? key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function samePhrase(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, '')
  return norm(a) === norm(b)
}

function resolveEngineKey(el: Element): string | null {
  const fromNode =
    normalizeKey(el.getAttribute('data-node-engine')) ??
    normalizeKey(el.getAttribute('data-engine'))
  if (fromNode) return fromNode

  const face = el.querySelector('[data-face-logo]')
  const fromFace = normalizeKey(face?.getAttribute('data-face-logo'))
  if (fromFace) return fromFace

  const nested = el.querySelector('[data-engine]')
  const fromNested = normalizeKey(nested?.getAttribute('data-engine'))
  if (fromNested) return fromNested

  const archetype = el.getAttribute('data-node-archetype') ?? ''
  return ARCHETYPE_BRAND[archetype] ?? null
}

/**
 * Keep the role/name on top and the engine underneath everywhere. When the
 * node label already *is* the engine (Redis, PostgreSQL), promote the role to
 * the title so we don't show the engine above the role.
 */
function resolveTooltip(
  label: string,
  engineKey: string | null,
  archetype: string,
): { title: string; subtitle: string | null } {
  const engineName = engineKey ? displayEngine(engineKey) : null
  const role = ARCHETYPE_ROLE[archetype] ?? null

  // Label already names the engine (Redis, PostgreSQL) → role on top, engine below.
  if (engineName && samePhrase(label, engineName)) {
    if (role && !samePhrase(role, engineName)) {
      return { title: role, subtitle: engineName }
    }
    return { title: label, subtitle: null }
  }

  if (engineName && !samePhrase(label, engineName)) {
    return { title: label, subtitle: engineName }
  }

  if (role && !samePhrase(label, role)) {
    return { title: label, subtitle: role }
  }
  return { title: label, subtitle: null }
}

type Props = {
  className?: string
  imgClassName?: string
  imgStyle?: CSSProperties
}

/**
 * Landing hero diagram: inlines the exported SVG so nodes can show
 * readable hover/click tooltips (on-canvas labels are stripped).
 */
export function InteractiveCanvasHero({
  className,
  imgClassName,
  imgStyle,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const svgHostRef = useRef<HTMLDivElement>(null)
  const pinnedIdRef = useRef<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [svgReady, setSvgReady] = useState(false)

  useEffect(() => {
    pinnedIdRef.current = pinnedId
  }, [pinnedId])

  const clearHover = useCallback(() => {
    if (pinnedIdRef.current) return
    setTooltip(null)
  }, [])

  useEffect(() => {
    const svgHost = svgHostRef.current
    if (!svgHost) return
    let cancelled = false
    const ac = new AbortController()

    void (async () => {
      try {
        const res = await fetch(canvasHeroUrl, { signal: ac.signal })
        const markup = await res.text()
        if (cancelled || !svgHostRef.current) return
        svgHostRef.current.innerHTML = markup
        const root = svgHostRef.current.querySelector('svg')
        if (!root) return

        root.removeAttribute('width')
        root.removeAttribute('height')
        root.setAttribute('role', 'img')
        root.setAttribute(
          'aria-label',
          'RunCloud9 isometric architecture canvas',
        )
        root.style.width = '100%'
        root.style.height = 'auto'
        root.style.display = 'block'
        root.style.overflow = 'visible'

        root
          .querySelectorAll(
            '[data-edge-layer], [data-zone-layer], [data-protocol-badge]',
          )
          .forEach((el) => {
            ;(el as SVGElement).style.pointerEvents = 'none'
          })

        const host = () => hostRef.current

        root.querySelectorAll('[data-export-node]').forEach((node) => {
          const el = node as SVGGElement
          el.style.pointerEvents = 'all'
          el.style.cursor = 'pointer'
          el.querySelectorAll('rect').forEach((child) => {
            const c = child as SVGRectElement
            if (c.getAttribute('fill') === 'transparent') {
              c.style.pointerEvents = 'fill'
              c.style.cursor = 'pointer'
            }
          })

          const showAt = (clientX: number, clientY: number) => {
            const box = host()?.getBoundingClientRect()
            if (!box) return
            const label = el.getAttribute('data-node-label') ?? 'Component'
            const archetype = el.getAttribute('data-node-archetype') ?? ''
            const engineKey = resolveEngineKey(el)
            const { title, subtitle } = resolveTooltip(
              label,
              engineKey,
              archetype,
            )
            setTooltip({
              title,
              subtitle,
              x: clientX - box.left,
              y: clientY - box.top,
            })
          }

          el.addEventListener('pointerenter', (e) => {
            if (pinnedIdRef.current) return
            showAt(e.clientX, e.clientY)
          })
          el.addEventListener('pointermove', (e) => {
            if (pinnedIdRef.current) return
            showAt(e.clientX, e.clientY)
          })
          el.addEventListener('pointerleave', () => {
            if (pinnedIdRef.current) return
            setTooltip(null)
          })
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            const id = el.getAttribute('data-node-id')
            if (pinnedIdRef.current === id) {
              pinnedIdRef.current = null
              setPinnedId(null)
              setTooltip(null)
              return
            }
            pinnedIdRef.current = id
            setPinnedId(id)
            showAt(e.clientX, e.clientY)
          })
        })
        setSvgReady(true)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        console.error('Failed to load canvas hero SVG', err)
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
      setSvgReady(false)
      svgHost.innerHTML = ''
    }
  }, [])

  useEffect(() => {
    if (!svgReady) return
    const root = svgHostRef.current?.querySelector('svg')
    if (!root) return
    if (imgClassName) root.setAttribute('class', imgClassName)
    else root.removeAttribute('class')
    if (imgStyle) Object.assign(root.style, imgStyle)
  }, [svgReady, imgClassName, imgStyle])

  useEffect(() => {
    const onDocPointer = (e: PointerEvent) => {
      if (!pinnedIdRef.current) return
      const hostEl = hostRef.current
      if (hostEl && e.target instanceof Node && hostEl.contains(e.target)) {
        return
      }
      pinnedIdRef.current = null
      setPinnedId(null)
      setTooltip(null)
    }
    document.addEventListener('pointerdown', onDocPointer)
    return () => document.removeEventListener('pointerdown', onDocPointer)
  }, [])

  return (
    <div
      ref={hostRef}
      className={className}
      onPointerLeave={clearHover}
    >
      <div ref={svgHostRef} />
      {tooltip ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[120%] rounded-md border border-[var(--c9-border)] bg-[var(--c9-bg-card)] px-3 py-2 shadow-lg shadow-black/40"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="whitespace-nowrap text-sm font-medium text-c9-text-heading">
            {tooltip.title}
          </p>
          {tooltip.subtitle ? (
            <p className="mt-0.5 whitespace-nowrap text-xs text-c9-text-muted">
              {tooltip.subtitle}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
