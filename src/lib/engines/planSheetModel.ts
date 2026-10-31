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

export interface PlanSheetSection {
  id: string
  title: string
  lines: string[]
  tone?: 'warn' | 'neutral'
}

export function planHasVisibleChanges(plan: DesignPlan): boolean {
  return (
    plan.nodes.added.length > 0 ||
    plan.nodes.removed.length > 0 ||
    plan.nodes.resized.length > 0 ||
    plan.edges.added.length > 0 ||
    plan.edges.removed.length > 0 ||
    plan.jobs.length > 0 ||
    plan.guarantees.length > 0 ||
    plan.warnings.length > 0 ||
    Boolean(plan.gated)
  )
}

/** View-model sections for PlanSheet.tsx. */
export function buildPlanSheetModel(plan: DesignPlan): PlanSheetSection[] {
  const sections: PlanSheetSection[] = []

  if (plan.gated === 'tier') {
    sections.push({
      id: 'gated',
      title: 'Subscription',
      lines: ['Some engine choices need a higher plan tier.'],
      tone: 'warn',
    })
  }

  const topology: string[] = []
  for (const id of plan.nodes.removed) topology.push(`Remove node ${id}`)
  for (const id of plan.nodes.added) topology.push(`Add node ${id}`)
  for (const id of plan.nodes.resized) topology.push(`Resize node ${id}`)
  for (const e of plan.edges.removed) topology.push(`Remove connection ${e}`)
  for (const e of plan.edges.added) topology.push(`Add connection ${e}`)
  if (topology.length > 0) {
    sections.push({ id: 'topology', title: 'Topology', lines: topology })
  }

  if (plan.jobs.length > 0) {
    sections.push({
      id: 'jobs',
      title: 'Jobs',
      lines: plan.jobs.map(
        (j) => `${j.job}: ${j.from || 'unbound'} → ${j.to} (${j.fit})`,
      ),
    })
  }

  const budgetLines: string[] = []
  if (plan.budget.pods !== 0) {
    budgetLines.push(
      `Pods ${plan.budget.pods > 0 ? '+' : ''}${plan.budget.pods}`,
    )
  }
  if (plan.budget.cpuMilli !== 0) {
    budgetLines.push(
      `CPU ${plan.budget.cpuMilli > 0 ? '+' : ''}${plan.budget.cpuMilli}m`,
    )
  }
  if (plan.budget.memMi !== 0) {
    budgetLines.push(
      `Memory ${plan.budget.memMi > 0 ? '+' : ''}${plan.budget.memMi} Mi`,
    )
  }
  budgetLines.push(
    plan.budget.roomFits ? 'Fits deploy room budget' : 'Exceeds deploy room budget',
  )
  sections.push({ id: 'budget', title: 'Resources', lines: budgetLines })

  if (plan.guarantees.length > 0) {
    sections.push({
      id: 'guarantees',
      title: 'Guarantees',
      lines: plan.guarantees.map((g) =>
        g.chaos ? `${g.change} (${g.chaos})` : g.change,
      ),
    })
  }

  if (plan.warnings.length > 0) {
    sections.push({
      id: 'warnings',
      title: 'Warnings',
      lines: plan.warnings,
      tone: 'warn',
    })
  }

  return sections
}
