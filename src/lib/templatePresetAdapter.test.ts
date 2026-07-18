import { describe, expect, it } from 'vitest'
import type { TemplatePreset } from './api'
import { templatePresetToCanvasSnapshot } from './templatePresetAdapter'

describe('templatePresetToCanvasSnapshot write-behind defaults', () => {
  it('seeds writeBehindIntervalSeconds=30 on url-shortener cache nodes', () => {
    const preset: TemplatePreset = {
      nodes: [
        {
          id: 'cache',
          type: 'cache',
          position: [0, 0, 0],
          label: 'Cache',
          config: { cacheStrategy: 'write-behind' },
        },
      ],
      edges: [],
    }

    const snapshot = templatePresetToCanvasSnapshot(preset, 'url-shortener')
    expect(snapshot.nodes[0].config.writeBehindIntervalSeconds).toBe(30)
  })

  it('does not overwrite an existing interval', () => {
    const preset: TemplatePreset = {
      nodes: [
        {
          id: 'cache',
          type: 'cache',
          position: [0, 0, 0],
          label: 'Cache',
          config: {
            cacheStrategy: 'write-behind',
            writeBehindIntervalSeconds: 90,
          },
        },
      ],
      edges: [],
    }

    const snapshot = templatePresetToCanvasSnapshot(preset, 'url-shortener')
    expect(snapshot.nodes[0].config.writeBehindIntervalSeconds).toBe(90)
  })

  it('does not seed for ecommerce', () => {
    const preset: TemplatePreset = {
      nodes: [
        {
          id: 'cache',
          type: 'cache',
          position: [0, 0, 0],
          label: 'Cache',
          config: { cacheStrategy: 'cache-aside' },
        },
      ],
      edges: [],
    }

    const snapshot = templatePresetToCanvasSnapshot(preset, 'ecommerce')
    expect(snapshot.nodes[0].config.writeBehindIntervalSeconds).toBeUndefined()
  })
})
