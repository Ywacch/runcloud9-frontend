export interface DesignPlanNodeDiff {
  added: string[]
  removed: string[]
  resized: string[]
}

export interface DesignPlanEdgeDiff {
  added: string[]
  removed: string[]
}

export interface DesignPlanJobMove {
  job: string
  from: string
  to: string
  fit: string
}

export interface DesignPlanBudgetDelta {
  pods: number
  cpuMilli: number
  memMi: number
  roomFits: boolean
}

export interface DesignPlanGuaranteeDelta {
  change: string
  chaos?: string
}

export interface DesignPlan {
  nodes: DesignPlanNodeDiff
  edges: DesignPlanEdgeDiff
  jobs: DesignPlanJobMove[]
  budget: DesignPlanBudgetDelta
  guarantees: DesignPlanGuaranteeDelta[]
  warnings: string[]
  gated?: string
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v))
}

/** Coerce POST /designs/plan JSON into a safe in-memory shape (API may omit null slices). */
export function normalizeDesignPlan(raw: unknown): DesignPlan {
  const body =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const nodes =
    body.nodes && typeof body.nodes === 'object'
      ? (body.nodes as Record<string, unknown>)
      : {}
  const edges =
    body.edges && typeof body.edges === 'object'
      ? (body.edges as Record<string, unknown>)
      : {}
  const budget =
    body.budget && typeof body.budget === 'object'
      ? (body.budget as Record<string, unknown>)
      : {}

  return {
    nodes: {
      added: stringList(nodes.added),
      removed: stringList(nodes.removed),
      resized: stringList(nodes.resized),
    },
    edges: {
      added: stringList(edges.added),
      removed: stringList(edges.removed),
    },
    jobs: Array.isArray(body.jobs)
      ? body.jobs.map((j) => {
          const row = j as Record<string, unknown>
          return {
            job: String(row.job ?? ''),
            from: String(row.from ?? ''),
            to: String(row.to ?? ''),
            fit: String(row.fit ?? ''),
          }
        })
      : [],
    budget: {
      pods: Number(budget.pods ?? 0),
      cpuMilli: Number(budget.cpuMilli ?? 0),
      memMi: Number(budget.memMi ?? 0),
      roomFits: budget.roomFits !== false,
    },
    guarantees: Array.isArray(body.guarantees)
      ? body.guarantees.map((g) => {
          const row = g as Record<string, unknown>
          return {
            change: String(row.change ?? ''),
            chaos: row.chaos != null ? String(row.chaos) : undefined,
          }
        })
      : [],
    warnings: stringList(body.warnings),
    gated: typeof body.gated === 'string' ? body.gated : undefined,
  }
}

export interface PlanSheetSection {
  id: string
  title: string
  lines: string[]
  tone?: 'warn' | 'neutral'
}

export function planHasVisibleChanges(plan: DesignPlan): boolean {
  const p = normalizeDesignPlan(plan)
  return (
    p.nodes.added.length > 0 ||
    p.nodes.removed.length > 0 ||
    p.nodes.resized.length > 0 ||
    p.edges.added.length > 0 ||
    p.edges.removed.length > 0 ||
    p.jobs.length > 0 ||
    p.guarantees.length > 0 ||
    p.warnings.length > 0 ||
    Boolean(p.gated)
  )
}

/** View-model sections for PlanSheet.tsx. */
export function buildPlanSheetModel(plan: DesignPlan): PlanSheetSection[] {
  const p = normalizeDesignPlan(plan)
  const sections: PlanSheetSection[] = []

  if (p.gated === 'tier') {
    sections.push({
      id: 'gated',
      title: 'Subscription',
      lines: ['Some engine choices need a higher plan tier.'],
      tone: 'warn',
    })
  }

  const topology: string[] = []
  for (const id of p.nodes.removed) topology.push(`Remove node ${id}`)
  for (const id of p.nodes.added) topology.push(`Add node ${id}`)
  for (const id of p.nodes.resized) topology.push(`Resize node ${id}`)
  for (const e of p.edges.removed) topology.push(`Remove connection ${e}`)
  for (const e of p.edges.added) topology.push(`Add connection ${e}`)
  if (topology.length > 0) {
    sections.push({ id: 'topology', title: 'Topology', lines: topology })
  }

  if (p.jobs.length > 0) {
    sections.push({
      id: 'jobs',
      title: 'Jobs',
      lines: p.jobs.map(
        (j) => `${j.job}: ${j.from || 'unbound'} → ${j.to} (${j.fit})`,
      ),
    })
  }

  const budgetLines: string[] = []
  if (p.budget.pods !== 0) {
    budgetLines.push(
      `Pods ${p.budget.pods > 0 ? '+' : ''}${p.budget.pods}`,
    )
  }
  if (p.budget.cpuMilli !== 0) {
    budgetLines.push(
      `CPU ${p.budget.cpuMilli > 0 ? '+' : ''}${p.budget.cpuMilli}m`,
    )
  }
  if (p.budget.memMi !== 0) {
    budgetLines.push(
      `Memory ${p.budget.memMi > 0 ? '+' : ''}${p.budget.memMi} Mi`,
    )
  }
  budgetLines.push(
    p.budget.roomFits ? 'Fits deploy room budget' : 'Exceeds deploy room budget',
  )
  sections.push({ id: 'budget', title: 'Resources', lines: budgetLines })

  if (p.guarantees.length > 0) {
    sections.push({
      id: 'guarantees',
      title: 'Guarantees',
      lines: p.guarantees.map((g) =>
        g.chaos ? `${g.change} (${g.chaos})` : g.change,
      ),
    })
  }

  if (p.warnings.length > 0) {
    sections.push({
      id: 'warnings',
      title: 'Warnings',
      lines: p.warnings,
      tone: 'warn',
    })
  }

  return sections
}
