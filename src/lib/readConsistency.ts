import { clampReadReplicas } from './replicaConfig'

/** Deploy wire values for database read routing policy. */
export const READ_CONSISTENCY_POLICIES = [
  'leader-only',
  'replica',
  'sticky',
  'ryw',
  'monotonic',
  'ryw+monotonic',
] as const

export type ReadConsistencyPolicy = (typeof READ_CONSISTENCY_POLICIES)[number]

export const DEFAULT_READ_CONSISTENCY: ReadConsistencyPolicy = 'leader-only'

const POLICY_SET = new Set<string>(READ_CONSISTENCY_POLICIES)

export const READ_CONSISTENCY_LABEL: Record<ReadConsistencyPolicy, string> = {
  'leader-only': 'Leader only',
  replica: 'Replica (eventual)',
  sticky: 'Sticky replica (per client)',
  ryw: 'Read-your-writes',
  monotonic: 'Monotonic reads',
  'ryw+monotonic': 'RYW + monotonic',
}

export const READ_CONSISTENCY_HELP: Record<ReadConsistencyPolicy, string> = {
  'leader-only': 'All reads go to the primary. Strongest consistency, no replica offload.',
  replica: 'Reads may use a replica without session stickiness or write tracking.',
  sticky:
    'Each client is pinned to one replica so related reads hit the same standby.',
  ryw: 'After a write, your session reads from the primary until the replica catches up.',
  monotonic: 'Reads stick to one replica so time never appears to go backwards.',
  'ryw+monotonic': 'Combines read-your-writes with monotonic replica stickiness.',
}

/** Policies that need at least two read replicas (mirrors backend clamp). */
export const MULTI_REPLICA_POLICIES = new Set<ReadConsistencyPolicy>([
  'monotonic',
  'ryw+monotonic',
])

export const READ_CONSISTENCY_CLAMP_HINT =
  'Monotonic policies need at least two read replicas. Deploy will use read-your-writes instead.'

export function readConsistencyFromConfig(raw: unknown): ReadConsistencyPolicy {
  const v = String(raw ?? DEFAULT_READ_CONSISTENCY).trim().toLowerCase()
  if (POLICY_SET.has(v)) return v as ReadConsistencyPolicy
  return DEFAULT_READ_CONSISTENCY
}

export function readConsistencyRequiresMultipleReplicas(
  policy: ReadConsistencyPolicy,
): boolean {
  return MULTI_REPLICA_POLICIES.has(policy)
}

export function readConsistencyOptionDisabled(
  policy: ReadConsistencyPolicy,
  readReplicas: number,
): boolean {
  const replicas = clampReadReplicas(readReplicas)
  if (policy === 'leader-only') return false
  if (replicas <= 0) return true
  if (readConsistencyRequiresMultipleReplicas(policy)) return replicas < 2
  return false
}

/**
 * Normalize for deploy wire. Clamps monotonic policies to `ryw` when
 * readReplicas < 2 (matches backend runtime_contract behavior).
 */
export function normalizeReadConsistencyForDeploy(
  raw: unknown,
  readReplicas: number,
): ReadConsistencyPolicy {
  const replicas = clampReadReplicas(readReplicas)
  const policy = readConsistencyFromConfig(raw)
  if (
    readConsistencyRequiresMultipleReplicas(policy) &&
    replicas < 2
  ) {
    return 'ryw'
  }
  if (policy !== 'leader-only' && replicas <= 0) {
    return DEFAULT_READ_CONSISTENCY
  }
  return policy
}
