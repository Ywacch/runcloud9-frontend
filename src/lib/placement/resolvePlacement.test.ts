import { describe, expect, it } from 'vitest'
import { LAYOUT_MATRIX } from './layoutMatrix'
import { resolvePlacement } from './resolvePlacement'

describe('resolvePlacement', () => {
  it.each(LAYOUT_MATRIX)('$id maps jobs to the same nodes as Go', (row) => {
    const topo = resolvePlacement({
      templateId: row.templateId,
      nodes: row.nodes,
      jobBindings: row.jobBindings,
    })
    for (const node of topo.nodes) {
      expect(node.members).toEqual([])
    }
    for (const [job, want] of Object.entries(row.want)) {
      const got = topo.jobs.find((j) => j.job === job)
      expect(got?.nodeId, job).toBe(want.nodeId)
      expect(Boolean(got?.shared), job).toBe(Boolean(want.shared))
    }
  })
})
