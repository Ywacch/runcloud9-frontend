import type { DeploymentDesign, DeploymentNode, ResourceProfilesResponse } from './deploymentTypes'
import { backendComponentToCanvasType } from './typeMapping'
import {
  formatCpuMilli,
  formatMemoryBytes,
  parseCpuMilli,
  parseMemoryBytes,
  scaleCpuMilli,
  scaleMemoryBytes,
} from './k8sQuantity'
import { getResourceProfilesCached } from './resourceProfileStore'
import { resolveProvisionedLimits } from './resolveProvisionedLimits'
import { resolveProxyProvisionedLimits } from './cacheProxyResources'
import { isProxyOrLegacyCacheStrategy } from './cacheTopologyStrategy'
import {
  DEFAULT_RESOURCE_TIER,
  loadgenLimits,
  normalizeResourceTier,
  tierResourceCaps,
} from './resourceTierCaps'
import { autoscaleFromConfig } from './autoscaleConfig'
import { clampAppServerReplicas, clampReadReplicas } from './replicaConfig'
import { normalizeInstanceSizes } from './instanceSizes'

export interface ResourceBudgetLine {
  label: string
  cpu: string
  memory: string
}

export interface ResourceBudgetErrorResponse {
  error: string
  tier: string
  requested: { cpu: string; memory: string }
  cap: { cpu: string; memory: string }
  breakdown: ResourceBudgetLine[]
}

export interface DesignBudgetSummary {
  tier: string
  requested: { cpu: string; memory: string }
  cap: { cpu: string; memory: string }
  breakdown: ResourceBudgetLine[]
  cpuMilli: number
  memoryBytes: number
}

const DEPLOYABLE_NODE_TYPES = new Set([
  'db',
  'mq',
  'cache',
  'app-server',
  'worker',
  'lb',
])

function replicasForBudget(node: DeploymentNode): number {
  if (node.type === 'app-server' || node.type === 'worker') {
    const ac = autoscaleFromConfig(node.config.autoscale)
    if (ac) return ac.max
    return clampAppServerReplicas(node.config.replicas ?? 1)
  }
  if (node.type === 'db') {
    return 1 + clampReadReplicas(node.config.readReplicas)
  }
  const raw = Math.floor(Number(node.config.replicas ?? 1))
  return Number.isFinite(raw) && raw >= 1 ? raw : 1
}

function addPerCopyBudgetLines(
  node: DeploymentNode,
  canvasType: NonNullable<(typeof backendComponentToCanvasType)[string]>,
  catalog: ResourceProfilesResponse,
  breakdown: ResourceBudgetLine[],
  totals: { cpuMilli: number; memoryBytes: number },
): void {
  const replicas = replicasForBudget(node)
  const sizes = normalizeInstanceSizes(node.config, replicas)
  const name = String(node.name ?? '').trim() || node.type
  const counts = new Map<string, number>()
  const order: string[] = []
  for (const size of sizes) {
    if (!counts.has(size)) order.push(size)
    counts.set(size, (counts.get(size) ?? 0) + 1)
  }
  for (const size of order) {
    const count = counts.get(size) ?? 0
    const limits = resolveProvisionedLimits(
      canvasType,
      { ...node.config, instanceSize: size },
      catalog,
    )
    const label = count > 1 ? `${name} ${size}×${count}` : `${name} ${size}`
    addLine(
      breakdown,
      label,
      scaleCpuMilli(limits.cpu, count),
      scaleMemoryBytes(limits.memory, count),
      totals,
    )
  }
}

function budgetNodeLabel(node: DeploymentNode, replicas: number): string {
  const name = String(node.name ?? '').trim() || node.type
  return replicas > 1 ? `${name}×${replicas}` : name
}

function addLine(
  breakdown: ResourceBudgetLine[],
  label: string,
  cpu: string,
  memory: string,
  totals: { cpuMilli: number; memoryBytes: number },
): void {
  const cpuMilli = parseCpuMilli(cpu)
  const memoryBytes = parseMemoryBytes(memory)
  totals.cpuMilli += cpuMilli
  totals.memoryBytes += memoryBytes
  breakdown.push({ label, cpu, memory })
}

function cacheStrategyFromConfig(config: Record<string, unknown>): string {
  return String(config.cacheStrategy ?? config.strategy ?? 'cache-aside')
}

/** Mirrors deployer.SumDesignResources for client-side preview and 422 UX. */
export function sumDesignBudget(
  design: DeploymentDesign,
  tier: string = DEFAULT_RESOURCE_TIER,
  catalog: ResourceProfilesResponse = getResourceProfilesCached(),
): DesignBudgetSummary {
  const normalizedTier = normalizeResourceTier(tier)
  const cap = tierResourceCaps(normalizedTier)
  const breakdown: ResourceBudgetLine[] = []
  const totals = { cpuMilli: 0, memoryBytes: 0 }

  for (const node of design.nodes) {
    if (!DEPLOYABLE_NODE_TYPES.has(node.type)) continue
    const canvasType = backendComponentToCanvasType[node.type]
    if (!canvasType) continue
    if (node.type === 'app-server' || node.type === 'worker' || node.type === 'db') {
      addPerCopyBudgetLines(node, canvasType, catalog, breakdown, totals)
      continue
    }
    const replicas = replicasForBudget(node)
    const limits = resolveProvisionedLimits(canvasType, node.config, catalog)
    const label = budgetNodeLabel(node, replicas)
    addLine(
      breakdown,
      label,
      scaleCpuMilli(limits.cpu, replicas),
      scaleMemoryBytes(limits.memory, replicas),
      totals,
    )
    // Mirrors deployer.ProxyCacheOverhead — second main container on proxy caches.
    if (
      node.type === 'cache' &&
      isProxyOrLegacyCacheStrategy(cacheStrategyFromConfig(node.config))
    ) {
      const proxyLimits = resolveProxyProvisionedLimits(node.config)
      addLine(
        breakdown,
        `${label} cache-proxy`,
        scaleCpuMilli(proxyLimits.cpu, replicas),
        scaleMemoryBytes(proxyLimits.memory, replicas),
        totals,
      )
    }
  }

  const lg = loadgenLimits(normalizedTier)
  addLine(breakdown, 'loadgen', lg.cpu, lg.memory, totals)

  return {
    tier: normalizedTier,
    requested: {
      cpu: formatCpuMilli(totals.cpuMilli),
      memory: formatMemoryBytes(totals.memoryBytes),
    },
    cap,
    breakdown,
    cpuMilli: totals.cpuMilli,
    memoryBytes: totals.memoryBytes,
  }
}

export function designExceedsResourceQuota(
  design: DeploymentDesign,
  tier: string = DEFAULT_RESOURCE_TIER,
  catalog?: ResourceProfilesResponse,
): DesignBudgetSummary | null {
  const summary = sumDesignBudget(design, tier, catalog)
  const capCpuMilli = parseCpuMilli(summary.cap.cpu)
  const capMemoryBytes = parseMemoryBytes(summary.cap.memory)
  if (
    summary.cpuMilli <= capCpuMilli &&
    summary.memoryBytes <= capMemoryBytes
  ) {
    return null
  }
  return summary
}

export function toResourceBudgetErrorResponse(
  summary: DesignBudgetSummary,
): ResourceBudgetErrorResponse {
  return {
    error: `design exceeds ${summary.tier} quota (need ${summary.requested.cpu} CPU / ${summary.requested.memory} memory, cap ${summary.cap.cpu} CPU / ${summary.cap.memory} memory)`,
    tier: summary.tier,
    requested: summary.requested,
    cap: summary.cap,
    breakdown: summary.breakdown,
  }
}

/** Plan label for canvas quota copy — internal maps to paid plan in UI. */
export function displayQuotaTierLabel(tier: string | undefined | null): string {
  switch (normalizeResourceTier(tier)) {
    case 'engineer':
    case 'internal':
      return 'Your plan'
    case 'architect':
      return 'Architect'
    default:
      return 'Free tier'
  }
}

/** Canvas-only CPU/RAM cap for a tier (session total minus loadgen). */
export function canvasCapForTier(tier: string | undefined | null): {
  cpu: string
  memory: string
} {
  const quotaTier = normalizeResourceTier(tier)
  const sessionCap = tierResourceCaps(quotaTier)
  const lg = loadgenLimits(quotaTier)
  return {
    cpu: formatCpuMilli(
      parseCpuMilli(sessionCap.cpu) - parseCpuMilli(lg.cpu),
    ),
    memory: formatMemoryBytes(
      parseMemoryBytes(sessionCap.memory) - parseMemoryBytes(lg.memory),
    ),
  }
}

type CanvasQuotaDisplayInput = Pick<
  ResourceBudgetErrorResponse,
  'tier' | 'requested' | 'cap' | 'breakdown'
> & { error?: string }

/** Canvas-only quota for UI — subtracts loadgen from session totals and cap. */
export function canvasQuotaForDisplay(
  budget: CanvasQuotaDisplayInput,
  tier?: string,
): ResourceBudgetErrorResponse {
  const quotaTier = normalizeResourceTier(tier ?? budget.tier)
  const loadgenRow = budget.breakdown.find((row) => row.label === 'loadgen')
  const breakdown = budget.breakdown.filter((row) => row.label !== 'loadgen')

  let requestedCpuMilli: number
  let requestedMemoryBytes: number
  if (loadgenRow) {
    requestedCpuMilli =
      parseCpuMilli(budget.requested.cpu) - parseCpuMilli(loadgenRow.cpu)
    requestedMemoryBytes =
      parseMemoryBytes(budget.requested.memory) -
      parseMemoryBytes(loadgenRow.memory)
  } else {
    requestedCpuMilli = breakdown.reduce(
      (total, row) => total + parseCpuMilli(row.cpu),
      0,
    )
    requestedMemoryBytes = breakdown.reduce(
      (total, row) => total + parseMemoryBytes(row.memory),
      0,
    )
  }

  const sessionCap = tierResourceCaps(quotaTier)
  const lg = loadgenLimits(quotaTier)
  const cap = {
    cpu: formatCpuMilli(
      parseCpuMilli(sessionCap.cpu) - parseCpuMilli(lg.cpu),
    ),
    memory: formatMemoryBytes(
      parseMemoryBytes(sessionCap.memory) - parseMemoryBytes(lg.memory),
    ),
  }
  const requested = {
    cpu: formatCpuMilli(requestedCpuMilli),
    memory: formatMemoryBytes(requestedMemoryBytes),
  }

  return {
    error:
      budget.error ??
      `design exceeds ${quotaTier} quota (need ${requested.cpu} CPU / ${requested.memory} memory, cap ${cap.cpu} CPU / ${cap.memory} memory)`,
    tier: quotaTier,
    requested,
    cap,
    breakdown,
  }
}

export function isResourceBudgetErrorResponse(
  value: unknown,
): value is ResourceBudgetErrorResponse {
  if (!value || typeof value !== 'object') return false
  const body = value as ResourceBudgetErrorResponse
  return (
    typeof body.error === 'string' &&
    Array.isArray(body.breakdown) &&
    typeof body.requested?.cpu === 'string' &&
    typeof body.cap?.cpu === 'string'
  )
}
