import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import {
  getAvailableCacheStrategies,
  isProxyCacheStrategy,
} from '../lib/cacheTopologyStrategy'
import { normalizeRedisEvictionPolicy } from '../lib/redisEvictionPolicy'
import {
  autoscaleFromConfig,
  clampAutoscaleCpuTarget,
  clampAutoscaleMax,
  clampAutoscaleMin,
  defaultAutoscale,
  type AutoscaleConfig,
} from '../lib/autoscaleConfig'
import { normalizeInstanceSize, normalizeInstanceSizes } from '../lib/instanceSizes'
import {
  clampAppServerReplicas,
  clampReadReplicas,
  clampWorkerReplicas,
  DB_READ_REPLICA_MAX,
} from '../lib/replicaConfig'
import { isInstanceSizePlanLocked, type InstanceSize } from '../lib/userTier'
import {
  filterStrategiesForVariation,
  variationCacheStrategyMode,
} from '../lib/variationTopologyLock'

type Patch = Partial<CanvasNode['config']>

export type CanvasDesignFieldLimits = {
  maxAppReplicas: number
  maxInstanceSize: InstanceSize
  allowAutoscale: boolean
}

type Opt = { value: string; label: string; why?: string }

const SIZES: Opt[] = [
  { value: 'small', label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'large', label: 'L' },
]

const SIZE_LINE: Record<string, string> = {
  small: 'Small · 125m CPU · 256Mi',
  medium: 'Medium · 250m CPU · 512Mi',
  large: 'Large · 500m CPU · 1Gi',
}

const STRATEGY: Record<string, { label: string; why: string }> = {
  'cache-aside': {
    label: 'Cache-aside',
    why: 'Reads Redis first, falls back to Postgres',
  },
  'write-through': {
    label: 'Write-through',
    why: 'Each write waits for Redis and Postgres',
  },
  'write-behind': {
    label: 'Write-behind',
    why: 'Fast writes; Postgres catches up later',
  },
  'timeline-store': {
    label: 'Timeline store',
    why: 'Feeds read straight from Redis lists',
  },
  timeline: {
    label: 'Timeline store',
    why: 'Feeds read straight from Redis lists',
  },
}

const TTL: Opt[] = [
  { value: '0', label: 'No expiry', why: 'Keys stay until evicted' },
  { value: '30', label: '30 s' },
  { value: '60', label: '60 s' },
  { value: '300', label: '5 min' },
  { value: '3600', label: '1 h' },
  { value: '86400', label: '24 h' },
]

const ONOFF: Opt[] = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
]

const MAXCONN: Opt[] = [
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: '200', label: '200' },
  { value: '500', label: '500' },
]

const MAXLEN: Opt[] = [
  { value: '0', label: 'Unlimited' },
  { value: '1000', label: '1,000' },
  { value: '10000', label: '10,000' },
  { value: '100000', label: '100,000' },
]

const ALGO: Opt[] = [
  { value: 'round-robin', label: 'round-robin', why: 'Servers take turns' },
  { value: 'least_conn', label: 'least_conn', why: 'Fewest open connections wins' },
  { value: 'random', label: 'random', why: 'A random server per request' },
  { value: 'ip_hash', label: 'ip_hash', why: 'Same client, same server' },
  { value: 'least_time', label: 'least_time', why: 'Fastest responder wins' },
]

function sizeLine(size: string, each: boolean): string {
  const base = SIZE_LINE[size] ?? SIZE_LINE.small
  return each ? `${base} each` : base
}

const EVICTION: Opt[] = [
  { value: 'allkeys-lru', label: 'allkeys-lru', why: 'Drops least recently used keys' },
  { value: 'allkeys-lfu', label: 'allkeys-lfu', why: 'Drops least often used keys' },
  { value: 'allkeys-random', label: 'allkeys-random', why: 'Drops random keys' },
  { value: 'volatile-lru', label: 'volatile-lru', why: 'Drops LRU keys that have a TTL' },
  { value: 'volatile-lfu', label: 'volatile-lfu', why: 'Drops LFU keys that have a TTL' },
  { value: 'volatile-random', label: 'volatile-random', why: 'Drops random keys that have a TTL' },
  { value: 'volatile-ttl', label: 'volatile-ttl', why: 'Drops keys closest to expiry' },
  { value: 'noeviction', label: 'noeviction', why: 'Writes fail when memory is full' },
]

function ttlWhy(seconds: number): string {
  if (!seconds) return 'Keys stay until evicted'
  const hit = TTL.find((o) => o.value === String(seconds))
  return `Keys refill from Postgres after ${hit?.label ?? `${seconds}s`}`
}

function sizeKey(config: CanvasNode['config']): string {
  const raw = String(config.instanceSize ?? config.resourceProfile ?? 'small').toLowerCase()
  if (raw.startsWith('l')) return 'large'
  if (raw.startsWith('m')) return 'medium'
  return 'small'
}

function CopySizeRows({
  sizes,
  maxInstanceSize,
  labelForIndex,
  onChangeCopy,
}: {
  sizes: string[]
  maxInstanceSize: InstanceSize
  labelForIndex: (index: number) => string
  onChangeCopy: (index: number, size: string) => void
}) {
  const options = SIZES.filter(
    (o) => !isInstanceSizePlanLocked(o.value, maxInstanceSize),
  )
  return sizes.map((size, i) => (
    <Row key={`copy-${i}`} label={labelForIndex(i)} why={sizeLine(sizeKey({ instanceSize: size } as CanvasNode['config']), true)}>
      <Seg
        label={labelForIndex(i)}
        value={sizeKey({ instanceSize: size } as CanvasNode['config'])}
        options={options}
        onChange={(v) => onChangeCopy(i, v)}
      />
    </Row>
  ))
}

function Row({
  label,
  why,
  warn,
  children,
}: {
  label: string
  why?: string
  warn?: boolean
  children: ReactNode
}) {
  return (
    <div className="cv-f">
      <span className="cv-fl">{label}</span>
      {children}
      {why ? <p className={`cv-c${warn ? ' is-warn' : ''}`}>{why}</p> : null}
    </div>
  )
}

function Seg({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Opt[]
  onChange: (value: string) => void
}) {
  return (
    <div className="cv-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Opt[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(
    null,
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value) ?? options[0]

  const placeMenu = () => {
    const trig = rootRef.current?.querySelector('button')
    if (!trig) return
    const r = trig.getBoundingClientRect()
    const width = Math.max(r.width, 120)
    setMenuBox({
      top: r.bottom + 4,
      left: Math.max(8, r.right - width),
      width,
    })
  }

  useEffect(() => {
    if (!open) return
    placeMenu()
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t)) return
      const menu = document.getElementById('cv-select-menu-open')
      if (menu?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', placeMenu, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', placeMenu, true)
    }
  }, [open])

  return (
    <div className={`cv-select${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="cv-select-trig"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{current?.label ?? value}</span>
        <i className="cv-select-chev" aria-hidden />
      </button>
      {open && menuBox ? (
        <ul
          id="cv-select-menu-open"
          className="cv-select-menu"
          role="listbox"
          aria-label={label}
          style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}
        >
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Num({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  unit?: string
  onChange: (next: number) => void
}) {
  return (
    <span className="cv-num">
      <input
        type="number"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') {
            onChange(min)
            return
          }
          const n = Math.min(max, Math.max(min, Math.floor(Number(raw) || 0)))
          onChange(n)
        }}
      />
      {unit ? <span className="cv-num-u">{unit}</span> : null}
    </span>
  )
}

function Step({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  disabled,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  disabled?: boolean
  onChange: (next: number) => void
}) {
  return (
    <span className="cv-step">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        −
      </button>
      <b>
        {value}
        {unit ? unit : ''}
      </b>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        +
      </button>
    </span>
  )
}

/**
 * Design config rows from runcloud9-ui canvas.js `fields()`:
 * one line of consequence, rare controls under More.
 */
export function CanvasDesignFields({
  node,
  nodes,
  edges,
  loadedVariationId,
  limits,
  updateConfig,
}: {
  node: CanvasNode
  nodes: Record<string, CanvasNode>
  edges: Record<string, CanvasEdge>
  loadedVariationId: string | null
  limits: CanvasDesignFieldLimits
  updateConfig: (patch: Patch) => void
}) {
  const c = node.config
  const size = sizeKey(c)
  const sizeOptions = SIZES.filter(
    (o) => !isInstanceSizePlanLocked(o.value, limits.maxInstanceSize),
  )

  const patchCopySize = (index: number, nextSize: string) => {
    const normalized = normalizeInstanceSize(nextSize)
    const count =
      node.type === 'database'
        ? 1 + clampReadReplicas(c.readReplicas ?? 0)
        : autoscaleFromConfig(c.autoscale)?.max ??
          (node.type === 'worker'
            ? clampWorkerReplicas(c.replicas ?? 1, limits.maxAppReplicas)
            : clampAppServerReplicas(c.replicas ?? 1, limits.maxAppReplicas))
    const sizes = normalizeInstanceSizes(c, count)
    sizes[index] = normalized
    updateConfig({ instanceSizes: sizes, instanceSize: sizes[0] })
  }

  const sizeRow = (each: boolean) => (
    <Row label="Size" why={sizeLine(size, each)}>
      <Seg
        label="Size"
        value={size}
        options={sizeOptions}
        onChange={(v) => updateConfig({ instanceSize: v, resourceProfile: v })}
      />
    </Row>
  )

  if (node.type === 'client') {
    return <p className="cv-c">Traffic source. No design settings.</p>
  }

  if (node.type === 'compute') {
    const scale = autoscaleFromConfig(c.autoscale)
    const replicas = clampAppServerReplicas(c.replicas ?? 1, limits.maxAppReplicas)
    const replicasLocked = limits.maxAppReplicas <= 1
    const copyCount = scale ? scale.max : replicas
    const copySizes = normalizeInstanceSizes(c, copyCount)
    const writeScale = (next: AutoscaleConfig | null) =>
      updateConfig({ autoscale: next ?? undefined })
    return (
      <>
        {sizeRow(replicas > 1 || scale != null)}
        <Row
          label="Replicas"
          why={
            replicasLocked
              ? 'Your plan allows one app-server copy'
              : scale
                ? `Autoscale: ${scale.min}–${scale.max} at ${scale.targetCPUPercent}% CPU`
                : replicas === 1
                  ? 'Single copy, no failover'
                  : `${replicas} copies share traffic`
          }
        >
          <Step
            label="Replicas"
            value={replicas}
            min={1}
            max={limits.maxAppReplicas}
            disabled={replicasLocked || scale != null}
            onChange={(n) => updateConfig({ replicas: n })}
          />
        </Row>
        <details className="cv-more">
          <summary>More</summary>
          <div className="cv-more-b">
            <Row
              label="Autoscale"
              why={
                !limits.allowAutoscale
                  ? 'CPU autoscale is limited to internal accounts'
                  : scale
                    ? 'Replicas follow CPU; budget counts max'
                    : 'Fixed replica count'
              }
            >
              <Seg
                label="Autoscale"
                value={scale ? 'on' : 'off'}
                options={ONOFF}
                onChange={(v) => {
                  if (v === 'on' && !limits.allowAutoscale) return
                  writeScale(
                    v === 'on'
                      ? (scale ?? defaultAutoscale(limits.maxAppReplicas))
                      : null,
                  )
                }}
              />
            </Row>
            {scale ? (
              <>
                <Row label="Min">
                  <Step
                    label="Min"
                    value={scale.min}
                    min={1}
                    max={scale.max}
                    disabled={!limits.allowAutoscale}
                    onChange={(n) =>
                      writeScale({
                        ...scale,
                        min: clampAutoscaleMin(n, scale.max),
                        max: clampAutoscaleMax(scale.max, n, limits.maxAppReplicas),
                      })
                    }
                  />
                </Row>
                <Row label="Max">
                  <Step
                    label="Max"
                    value={scale.max}
                    min={scale.min}
                    max={limits.maxAppReplicas}
                    disabled={!limits.allowAutoscale}
                    onChange={(n) =>
                      writeScale({
                        ...scale,
                        max: clampAutoscaleMax(n, scale.min, limits.maxAppReplicas),
                        min: clampAutoscaleMin(scale.min, n),
                      })
                    }
                  />
                </Row>
                <Row label="Target CPU">
                  <Step
                    label="Target CPU"
                    value={scale.targetCPUPercent}
                    min={30}
                    max={90}
                    step={10}
                    unit="%"
                    disabled={!limits.allowAutoscale}
                    onChange={(n) =>
                      writeScale({
                        ...scale,
                        targetCPUPercent: clampAutoscaleCpuTarget(n),
                      })
                    }
                  />
                </Row>
              </>
            ) : null}
            {copyCount > 1 ? (
              <CopySizeRows
                sizes={copySizes}
                maxInstanceSize={limits.maxInstanceSize}
                labelForIndex={(i) => `Replica ${i + 1} size`}
                onChangeCopy={patchCopySize}
              />
            ) : null}
          </div>
        </details>
      </>
    )
  }

  if (node.type === 'worker') {
    const scale = autoscaleFromConfig(c.autoscale)
    const replicas = clampWorkerReplicas(c.replicas ?? 1, limits.maxAppReplicas)
    const copyCount = scale ? scale.max : replicas
    const copySizes = normalizeInstanceSizes(c, copyCount)
    const concurrency = Math.max(1, Number(c.workerConcurrency ?? 1) || 1)
    const prefetch = Math.max(1, Number(c.workerPrefetch ?? 10) || 10)
    const writeScale = (next: AutoscaleConfig | null) =>
      updateConfig({ autoscale: next ?? undefined })
    return (
      <>
        {sizeRow(replicas > 1 || scale != null)}
        <Row
          label="Replicas"
          why={
            scale
              ? `Autoscale: ${scale.min}–${scale.max} at ${scale.targetCPUPercent}% CPU`
              : replicas === 1
                ? 'One consumer drains the queue'
                : `${replicas} consumers in parallel`
          }
        >
          <Step
            label="Replicas"
            value={replicas}
            min={1}
            max={limits.maxAppReplicas}
            disabled={scale != null}
            onChange={(n) => updateConfig({ replicas: n })}
          />
        </Row>
        <Row
          label="Concurrency"
          why={
            concurrency === 1
              ? 'One job at a time, in order'
              : `${concurrency} jobs at once per replica`
          }
        >
          <Step
            label="Concurrency"
            value={concurrency}
            min={1}
            max={16}
            onChange={(n) => updateConfig({ workerConcurrency: n })}
          />
        </Row>
        <details className="cv-more">
          <summary>More</summary>
          <div className="cv-more-b">
            <Row label="Prefetch" why={`Holds ${prefetch} unacked messages each`}>
              <Step
                label="Prefetch"
                value={prefetch}
                min={1}
                max={100}
                onChange={(n) => updateConfig({ workerPrefetch: n })}
              />
            </Row>
            <Row
              label="Autoscale"
              why={
                !limits.allowAutoscale
                  ? 'CPU autoscale is limited to internal accounts'
                  : scale
                    ? 'Replicas follow CPU; budget counts max'
                    : 'Fixed replica count'
              }
            >
              <Seg
                label="Autoscale"
                value={scale ? 'on' : 'off'}
                options={ONOFF}
                onChange={(v) => {
                  if (v === 'on' && !limits.allowAutoscale) return
                  writeScale(
                    v === 'on'
                      ? (scale ?? defaultAutoscale(limits.maxAppReplicas))
                      : null,
                  )
                }}
              />
            </Row>
            {scale ? (
              <>
                <Row label="Min">
                  <Step
                    label="Min"
                    value={scale.min}
                    min={1}
                    max={scale.max}
                    disabled={!limits.allowAutoscale}
                    onChange={(n) =>
                      writeScale({
                        ...scale,
                        min: clampAutoscaleMin(n, scale.max),
                        max: clampAutoscaleMax(scale.max, n, limits.maxAppReplicas),
                      })
                    }
                  />
                </Row>
                <Row label="Max">
                  <Step
                    label="Max"
                    value={scale.max}
                    min={scale.min}
                    max={limits.maxAppReplicas}
                    disabled={!limits.allowAutoscale}
                    onChange={(n) =>
                      writeScale({
                        ...scale,
                        max: clampAutoscaleMax(n, scale.min, limits.maxAppReplicas),
                        min: clampAutoscaleMin(scale.min, n),
                      })
                    }
                  />
                </Row>
                <Row label="Target CPU">
                  <Step
                    label="Target CPU"
                    value={scale.targetCPUPercent}
                    min={30}
                    max={90}
                    step={10}
                    unit="%"
                    disabled={!limits.allowAutoscale}
                    onChange={(n) =>
                      writeScale({
                        ...scale,
                        targetCPUPercent: clampAutoscaleCpuTarget(n),
                      })
                    }
                  />
                </Row>
              </>
            ) : null}
            {copyCount > 1 ? (
              <CopySizeRows
                sizes={copySizes}
                maxInstanceSize={limits.maxInstanceSize}
                labelForIndex={(i) => `Replica ${i + 1} size`}
                onChangeCopy={patchCopySize}
              />
            ) : null}
          </div>
        </details>
      </>
    )
  }

  if (node.type === 'database') {
    const reads = clampReadReplicas(c.readReplicas ?? 0)
    const dbCopyCount = 1 + reads
    const dbCopySizes = normalizeInstanceSizes(c, dbCopyCount)
    const maxConn = String(c.maxConnections ?? 100)
    const conn = MAXCONN.some((o) => o.value === maxConn) ? maxConn : '100'
    return (
      <>
        {sizeRow(reads > 0)}
        <Row
          label="Read replicas"
          why={
            reads
              ? `Reads spread over ${reads} replica${reads > 1 ? 's' : ''}`
              : 'All reads hit the primary'
          }
        >
          <Step
            label="Read replicas"
            value={reads}
            min={0}
            max={DB_READ_REPLICA_MAX}
            onChange={(n) => updateConfig({ readReplicas: n })}
          />
        </Row>
        <details className="cv-more">
          <summary>More</summary>
          <div className="cv-more-b">
            {reads >= 1 ? (
              <CopySizeRows
                sizes={dbCopySizes}
                maxInstanceSize={limits.maxInstanceSize}
                labelForIndex={(i) => (i === 0 ? 'Primary size' : `Replica ${i} size`)}
                onChangeCopy={patchCopySize}
              />
            ) : null}
            <Row label="Max connections" why={`Beyond ${conn}, new connections wait`}>
              <Select
                label="Max connections"
                value={conn}
                options={MAXCONN}
                onChange={(v) => updateConfig({ maxConnections: Number(v) })}
              />
            </Row>
          </div>
        </details>
      </>
    )
  }

  if (node.type === 'message_queue') {
    const maxLen = String(c.maxLength ?? 0)
    const len = MAXLEN.some((o) => o.value === maxLen) ? maxLen : '0'
    const n = Number(len)
    return (
      <>
        {sizeRow(false)}
        <details className="cv-more">
          <summary>More</summary>
          <div className="cv-more-b">
            <Row
              label="Max length"
              why={
                n
                  ? `Rejects publishes past ${n.toLocaleString('en')}`
                  : 'Grows until memory runs out'
              }
            >
              <Select
                label="Max length"
                value={len}
                options={MAXLEN}
                onChange={(v) => updateConfig({ maxLength: Number(v) })}
              />
            </Row>
          </div>
        </details>
      </>
    )
  }

  if (node.type === 'load_balancer') {
    const algo = String(c.algorithm ?? c.lbAlgorithm ?? 'round-robin')
    const algoValue = ALGO.some((o) => o.value === algo) ? algo : 'round-robin'
    const why = ALGO.find((o) => o.value === algoValue)?.why ?? ''
    const weighted = Boolean(c.weightByInstanceSize)
    const rateN = Math.min(100, Math.max(0, Math.floor(Number(c.rateLimitPerIp ?? 0) || 0)))
    return (
      <>
        {sizeRow(false)}
        <Row label="Algorithm" why={why}>
          <Select
            label="Algorithm"
            value={algoValue}
            options={ALGO}
            onChange={(v) => updateConfig({ algorithm: v, lbAlgorithm: v })}
          />
        </Row>
        <Row
          label="Weight by size"
          why={
            weighted
              ? 'Share follows size: S 1 · M 2 · L 4'
              : 'Equal share per server'
          }
        >
          <Seg
            label="Weight by size"
            value={weighted ? 'on' : 'off'}
            options={ONOFF}
            onChange={(v) => updateConfig({ weightByInstanceSize: v === 'on' })}
          />
        </Row>
        <details className="cv-more">
          <summary>More</summary>
          <div className="cv-more-b">
            <Row
              label="Per-IP request limit"
              why={
                rateN
                  ? `Over ${rateN} req/s per IP gets 429`
                  : 'No per-client limit'
              }
            >
              <Num
                label="Per-IP request limit"
                value={rateN}
                min={0}
                max={100}
                unit="rps"
                onChange={(n) => updateConfig({ rateLimitPerIp: n })}
              />
            </Row>
          </div>
        </details>
      </>
    )
  }

  if (node.type === 'cache') {
    const mode = variationCacheStrategyMode(loadedVariationId)
    const available = filterStrategiesForVariation(
      getAvailableCacheStrategies(node.id, nodes, edges, {
        allowProxyStrategies: mode !== 'frozen',
      }),
      loadedVariationId,
    )
    const strategy = String(c.cacheStrategy ?? c.strategy ?? 'cache-aside')
    const options = available.length > 0 ? available : [strategy]
    const frozen = mode === 'frozen' || options.length <= 1
    const meta = STRATEGY[strategy] ?? { label: strategy, why: '' }
    const fixedWhy =
      strategy === 'cache-aside'
        ? 'Fixed: Redis sits beside the app only'
        : strategy === 'timeline-store' || strategy === 'timeline'
          ? 'Fixed: the app pushes timelines here'
          : options.length <= 1
            ? 'Fixed for this variation'
            : meta.why
    const ttl = Number(c.cacheTtlSeconds ?? 300)
    const ttlValue = TTL.some((o) => o.value === String(ttl)) ? String(ttl) : '300'
    const eviction = normalizeRedisEvictionPolicy(c.evictionPolicy)
    const ev = EVICTION.find((o) => o.value === eviction) ?? EVICTION[0]
    const volatileNoTtl = eviction.startsWith('volatile') && ttl === 0
    const showProxy = isProxyCacheStrategy(strategy)
    const proxy = sizeKey({
      instanceSize: c.proxyInstanceSize ?? c.proxyResourceProfile ?? 'small',
    } as CanvasNode['config'])

    return (
      <>
        {sizeRow(false)}
        <Row label="Strategy" why={frozen ? fixedWhy : meta.why}>
          {frozen ? (
            <span className="cv-ro">{meta.label}</span>
          ) : (
            <Select
              label="Strategy"
              value={options.includes(strategy) ? strategy : options[0]}
              options={options.map((id) => ({
                value: id,
                label: STRATEGY[id]?.label ?? id,
              }))}
              onChange={(v) => updateConfig({ cacheStrategy: v, strategy: v })}
            />
          )}
        </Row>
        <Row label="TTL" why={ttlWhy(Number(ttlValue))}>
          <Select
            label="TTL"
            value={ttlValue}
            options={TTL}
            onChange={(v) => updateConfig({ cacheTtlSeconds: Number(v) })}
          />
        </Row>
        <details className="cv-more">
          <summary>More</summary>
          <div className="cv-more-b">
            <Row
              label="Eviction"
              why={
                volatileNoTtl
                  ? 'No TTL set, so this acts like noeviction'
                  : ev.why
              }
              warn={volatileNoTtl}
            >
              <Select
                label="Eviction"
                value={eviction}
                options={EVICTION}
                onChange={(v) => updateConfig({ evictionPolicy: v })}
              />
            </Row>
            {showProxy ? (
              <Row label="Proxy size" why={sizeLine(proxy, false)}>
                <Seg
                  label="Proxy size"
                  value={proxy}
                  options={SIZES}
                  onChange={(v) =>
                    updateConfig({
                      proxyInstanceSize: v,
                      proxyResourceProfile: v,
                    })
                  }
                />
              </Row>
            ) : null}
          </div>
        </details>
      </>
    )
  }

  return sizeRow(false)
}
