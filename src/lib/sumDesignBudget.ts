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
import { clampAppServerReplicas } from './replicaConfig'

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
    return clampAppServerReplicas(node.config.replicas ?? 1)
  }
  const raw = Math.floor(Number(node.config.replicas ?? 1))
  return Number.isFinite(raw) && raw >= 1 ? raw : 1
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
