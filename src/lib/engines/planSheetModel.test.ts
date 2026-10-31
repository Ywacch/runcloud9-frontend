import { describe, expect, it } from 'vitest'
import { buildPlanSheetModel, type DesignPlan } from './planSheetModel'

describe('buildPlanSheetModel', () => {
  it('summarizes timeline consolidation', () => {
    const plan: DesignPlan = {
      nodes: { added: [], removed: ['cache-1'], resized: [] },
      edges: { added: [], removed: ['worker-1->cache-1'] },
      jobs: [
        {
          job: 'timeline',
          from: 'cache-1/redis',
          to: 'db-1/postgresql',
          fit: 'workable',
        },
      ],
      budget: { pods: -1, cpuMilli: -500, memMi: -256, roomFits: true },
      guarantees: [],
      warnings: [],
    }
    const sections = buildPlanSheetModel(plan)
    const topo = sections.find((s) => s.id === 'topology')
    expect(topo?.lines.some((l) => l.includes('cache-1'))).toBe(true)
    const jobs = sections.find((s) => s.id === 'jobs')
    expect(jobs?.lines[0]).toContain('timeline')
    const budget = sections.find((s) => s.id === 'budget')
    expect(budget?.lines.some((l) => l.includes('Pods -1'))).toBe(true)
  })

  it('includes tier gate banner', () => {
    const sections = buildPlanSheetModel({
      nodes: { added: [], removed: [], resized: [] },
      edges: { added: [], removed: [] },
      jobs: [],
      budget: { pods: 0, cpuMilli: 0, memMi: 0, roomFits: true },
      guarantees: [],
      warnings: [],
      gated: 'tier',
    })
    expect(sections.some((s) => s.id === 'gated')).toBe(true)
  })
})
