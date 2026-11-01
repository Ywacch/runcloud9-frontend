import type { UnitOffset } from '../compose/composeAppServer'
import { prefersReducedMotion } from '../fx/reducedMotion'

export type MotionUnit = {
  id: string
  dx: number
  dy: number
  opacity: number
  scale: number
  /** True while this unit is fading out after it left the target set. */
  leaving?: boolean
}

export type UnitAnim = {
  id: string
  fromDx: number
  fromDy: number
  toDx: number
  toDy: number
  fromO: number
  toO: number
  fromS: number
  toS: number
  removeAtEnd: boolean
  startMs: number
}

type NodeMotion = {
  units: MotionUnit[]
  anims: UnitAnim[]
}

export const DURATION_MS = 200
export const STAGGER_MS = 30
const SPAWN_SCALE = 0.6

let nodes = new Map<string, NodeMotion>()
let epoch = 0
const listeners = new Set<() => void>()
let rafId: number | null = null

export function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return 1 - (1 - x) ** 3
}

function unitId(index: number): string {
  return `u${index}`
}

function notify(): void {
  epoch += 1
  for (const listener of listeners) listener()
}

export function motionKeyForNode(nodeId: string): string {
  const m = nodes.get(nodeId)
  if (!m) return ''
  return m.units
    .map((u) => `${u.id}:${u.dx},${u.dy},${u.opacity},${u.scale},${u.leaving ? 1 : 0}`)
    .join('|')
}

function resolveTargetId(
  index: number,
  targetIds: string[] | undefined,
): string {
  const id = targetIds?.[index]
  return id && id.length > 0 ? id : unitId(index)
}

export function planUnitTransition(
  current: MotionUnit[],
  target: UnitOffset[],
  primarySeat: UnitOffset = { dx: 0, dy: 0 },
  now = 0,
  options: { animateSpawn?: boolean; targetIds?: string[] } = {},
): { units: MotionUnit[]; anims: UnitAnim[] } {
  const animateSpawn = options.animateSpawn !== false
  const targetIds = options.targetIds
  const anims: UnitAnim[] = []
  const nextUnits: MotionUnit[] = []

  if (target.length === current.length) {
    for (let i = 0; i < target.length; i++) {
      const c = current[i]
      const t = target[i]
      const id = c?.id ?? resolveTargetId(i, targetIds)
      const fromDx = c?.dx ?? t.dx
      const fromDy = c?.dy ?? t.dy
      const fromO = c?.opacity ?? 1
      const fromS = c?.scale ?? 1
      nextUnits.push({ id, dx: fromDx, dy: fromDy, opacity: fromO, scale: fromS })
      if (fromDx !== t.dx || fromDy !== t.dy || fromO !== 1 || fromS !== 1) {
        anims.push({
          id,
          fromDx,
          fromDy,
          toDx: t.dx,
          toDy: t.dy,
          fromO,
          toO: 1,
          fromS,
          toS: 1,
          removeAtEnd: false,
          startMs: now,
        })
      }
    }
    return { units: nextUnits, anims }
  }

  if (target.length > current.length) {
    const existingById = new Map(current.map((u) => [u.id, u]))
    for (let i = 0; i < target.length; i++) {
      const t = target[i]
      const id = resolveTargetId(i, targetIds)
      const prev = existingById.get(id)
      const isNew = !prev
      if (isNew && !animateSpawn) {
        nextUnits.push({ id, dx: t.dx, dy: t.dy, opacity: 1, scale: 1 })
        continue
      }
      const fromDx = isNew ? primarySeat.dx : prev.dx
      const fromDy = isNew ? primarySeat.dy : prev.dy
      const fromO = isNew ? 0 : prev.opacity
      const fromS = isNew ? SPAWN_SCALE : prev.scale
      nextUnits.push({ id, dx: fromDx, dy: fromDy, opacity: fromO, scale: fromS })
      anims.push({
        id,
        fromDx,
        fromDy,
        toDx: t.dx,
        toDy: t.dy,
        fromO,
        toO: 1,
        fromS,
        toS: 1,
        removeAtEnd: false,
        startMs: now + (isNew ? STAGGER_MS * i : 0),
      })
    }
    return { units: nextUnits, anims }
  }

  const survivingIds = new Set(
    target.map((_, i) => resolveTargetId(i, targetIds)),
  )
  for (const c of current) {
    if (!survivingIds.has(c.id)) {
      if (!animateSpawn) continue
      nextUnits.push({ ...c, leaving: true })
      anims.push({
        id: c.id,
        fromDx: c.dx,
        fromDy: c.dy,
        toDx: primarySeat.dx,
        toDy: primarySeat.dy,
        fromO: c.opacity,
        toO: 0,
        fromS: c.scale,
        toS: SPAWN_SCALE,
        removeAtEnd: true,
        startMs: now,
      })
    }
  }
  for (let i = 0; i < target.length; i++) {
    const t = target[i]
    const id = resolveTargetId(i, targetIds)
    const prev = current.find((u) => u.id === id)
    const fromDx = prev?.dx ?? t.dx
    const fromDy = prev?.dy ?? t.dy
    const fromO = prev?.opacity ?? 1
    const fromS = prev?.scale ?? 1
    if (!nextUnits.some((u) => u.id === id)) {
      nextUnits.push({ id, dx: fromDx, dy: fromDy, opacity: fromO, scale: fromS })
    }
    if (fromDx !== t.dx || fromDy !== t.dy || fromO !== 1 || fromS !== 1) {
      anims.push({
        id,
        fromDx,
        fromDy,
        toDx: t.dx,
        toDy: t.dy,
        fromO,
        toO: 1,
        fromS,
        toS: 1,
        removeAtEnd: false,
        startMs: now,
      })
    }
  }
  return { units: nextUnits, anims }
}

function advanceFrame(now: number): void {
  let anyActive = false
  const toClear: string[] = []

  for (const [nodeId, motion] of nodes) {
    if (motion.anims.length === 0) {
      toClear.push(nodeId)
      continue
    }

    const unitsById = new Map(motion.units.map((u) => [u.id, { ...u }]))
    let stillAnimating = false

    for (const anim of motion.anims) {
      const elapsed = now - anim.startMs
      if (elapsed < 0) {
        stillAnimating = true
        continue
      }
      const t = easeOutCubic(elapsed / DURATION_MS)
      const u = unitsById.get(anim.id)
      if (!u) continue
      if (t >= 1) {
        if (anim.removeAtEnd) unitsById.delete(anim.id)
        else {
          u.dx = anim.toDx
          u.dy = anim.toDy
          u.opacity = anim.toO
          u.scale = anim.toS
        }
      } else {
        stillAnimating = true
        u.dx = anim.fromDx + (anim.toDx - anim.fromDx) * t
        u.dy = anim.fromDy + (anim.toDy - anim.fromDy) * t
        u.opacity = anim.fromO + (anim.toO - anim.fromO) * t
        u.scale = anim.fromS + (anim.toS - anim.fromS) * t
      }
    }

    const remainingAnims = motion.anims.filter((a) => {
      const elapsed = now - a.startMs
      return elapsed < 0 || elapsed / DURATION_MS < 1
    })

    if (stillAnimating || remainingAnims.length > 0) {
      anyActive = true
      nodes.set(nodeId, { units: [...unitsById.values()], anims: remainingAnims })
    } else {
      toClear.push(nodeId)
    }
  }

  for (const id of toClear) nodes.delete(id)

  if (anyActive) {
    notify()
    rafId = requestAnimationFrame(advanceFrame)
  } else {
    rafId = null
    if (toClear.length > 0) notify()
  }
}

function ensureRaf(): void {
  if (rafId !== null) return
  rafId = requestAnimationFrame(advanceFrame)
}

export function getNodeMotion(nodeId: string): MotionUnit[] | null {
  const m = nodes.get(nodeId)
  return m ? m.units.map((u) => ({ ...u })) : null
}

export function getUnitMotionEpoch(): number {
  return epoch
}

export function subscribeUnitMotion(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => listeners.delete(onStoreChange)
}

export function clearNodeMotion(nodeId: string): void {
  if (!nodes.has(nodeId)) return
  nodes.delete(nodeId)
  notify()
}

export function retarget(
  nodeId: string,
  target: UnitOffset[],
  primarySeat: UnitOffset = { dx: 0, dy: 0 },
  options: { animateSpawn?: boolean; targetIds?: string[] } = {},
): void {
  const current = nodes.get(nodeId)?.units ?? []
  const now = performance.now()

  if (prefersReducedMotion()) {
    if (nodes.has(nodeId)) nodes.delete(nodeId)
    notify()
    return
  }

  const { units, anims } = planUnitTransition(
    current,
    target,
    primarySeat,
    now,
    options,
  )

  if (anims.length === 0) {
    if (nodes.has(nodeId)) nodes.delete(nodeId)
    notify()
    return
  }

  nodes.set(nodeId, { units, anims })
  notify()
  ensureRaf()
}