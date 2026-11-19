import { useEffect, useState } from 'react'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type {
  ParsedProvisionMetrics,
  ReplicaWaitRow,
} from './provisionMetrics'
import { canvasInstanceCount } from './provisionMetrics'
import { canvasToBackend } from './typeMapping'

export const DEV_PROVISION_PREVIEW_KEY = 'runcloud9.devProvisionPreview'

function isDev(): boolean {
  return import.meta.env.DEV
}

export function isDevProvisionPreviewEnabled(
  search = typeof window !== 'undefined' ? window.location.search : '',
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): boolean {
  if (!isDev()) return false
  const q = new URLSearchParams(search)
  if (q.get('provision') === 'preview') return true
  try {
    return storage?.getItem(DEV_PROVISION_PREVIEW_KEY) === '1'
  } catch {
    return false
  }
}

export function writeDevProvisionPreviewEnabled(
  on: boolean,
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null = typeof localStorage !==
  'undefined'
    ? localStorage
    : null,
): void {
  try {
    if (on) storage?.setItem(DEV_PROVISION_PREVIEW_KEY, '1')
    else storage?.removeItem(DEV_PROVISION_PREVIEW_KEY)
  } catch {
    /* private mode / quota */
  }
}

function syncProvisionQuery(on: boolean): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (on) url.searchParams.set('provision', 'preview')
  else url.searchParams.delete('provision')
  const next = `${url.pathname}${url.search}${url.hash}`
  const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (next !== cur) window.history.replaceState(null, '', next)
}

let cached: boolean | null = null
const listeners = new Set<(on: boolean) => void>()

export function getDevProvisionPreviewEnabled(): boolean {
  if (!isDev()) return false
  if (cached === null) {
    cached = isDevProvisionPreviewEnabled()
  }
  return cached
}

export function setDevProvisionPreviewEnabled(on: boolean): void {
  if (!isDev()) return
  cached = on
  writeDevProvisionPreviewEnabled(on)
  syncProvisionQuery(on)
  listeners.forEach((listener) => listener(on))
}

export function subscribeDevProvisionPreviewEnabled(
  listener: (on: boolean) => void,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useDevProvisionPreviewEnabled(): boolean {
  const [on, setOn] = useState(getDevProvisionPreviewEnabled)
  useEffect(() => subscribeDevProvisionPreviewEnabled(setOn), [])
  return isDev() ? on : false
}

/** @internal test helper */
export function resetDevProvisionPreviewCache(): void {
  cached = null
}

function rank(node: CanvasNode): number {
  const kind = canvasToBackend[node.type]
  const order = ['db', 'cache', 'mq', 'app-server', 'worker', 'lb']
  const i = order.indexOf(kind)
  return i < 0 ? 99 : i
}

/**
 * Cycle a real-shaped provision snapshot from the canvas nodes.
 * Status codes match ganymede; no fake log lines.
 */
export function buildDevProvisionMetrics(
  nodes: Record<string, CanvasNode>,
  elapsedSec: number,
): ParsedProvisionMetrics {
  const list = Object.values(nodes)
    .filter((n) => n.type !== 'client')
    .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))

  const stage = Math.min(3, Math.floor(Math.max(0, elapsedSec) / 6))

  const componentStatus: Record<string, string> = {}
  const replicaStatus: Record<string, ReplicaWaitRow[]> = {}

  list.forEach((node, index) => {
    let state = 'pending'
    if (stage <= 0) state = 'pending'
    else if (stage === 1) state = index === 0 ? 'deploying' : 'pending'
    else if (stage === 2) {
      if (index === 0) state = 'ready'
      else if (index === 1) state = 'deploying'
      else state = 'pending'
    } else state = 'ready'

    componentStatus[node.id] = state

    const expected = canvasInstanceCount(node, canvasToBackend[node.type])
    const rows: ReplicaWaitRow[] = []
    for (let ordinal = 1; ordinal <= expected; ordinal++) {
      let waitCode = 'pending'
      let ready = false
      if (state === 'ready') {
        waitCode = 'ready'
        ready = true
      } else if (state === 'deploying') {
        if (ordinal === 1) {
          waitCode = stage >= 2 ? 'ready' : 'pulling_image'
          ready = stage >= 2
        } else {
          waitCode = stage >= 3 ? 'ready' : 'starting'
          ready = stage >= 3
        }
      }
      rows.push({ ordinal, ready, waitCode })
    }
    if (expected > 1 || state === 'deploying') replicaStatus[node.id] = rows
  })

  const db = list.find((n) => n.type === 'database')
  let seedingStatus: ParsedProvisionMetrics['seedingStatus'] = 'pending'
  if (stage >= 3) seedingStatus = 'done'
  else if (stage === 2 && db && componentStatus[db.id] === 'ready') {
    seedingStatus = 'seeding'
  }

  return {
    provisionPhase: 'deploying',
    componentStatus,
    seedingStatus,
    loadgenStatus: stage >= 3 ? 'ready' : 'pending',
    replicaStatus,
    provisionDetailCode:
      seedingStatus === 'seeding'
        ? 'loading_sample_data'
        : stage === 1
          ? 'pulling_image'
          : 'layer_deploying',
  }
}
