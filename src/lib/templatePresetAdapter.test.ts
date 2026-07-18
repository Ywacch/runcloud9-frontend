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

  it('does not seed write-behind interval for ecommerce', () => {
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

describe('templatePresetToCanvasSnapshot cache TTL defaults', () => {
  it.each([
    ['url-shortener', 300],
    ['ecommerce', 60],
    ['social-feed', 0],
  ] as const)('seeds %s with cacheTtlSeconds=%i', (templateId, ttl) => {
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

    const snapshot = templatePresetToCanvasSnapshot(preset, templateId)
    expect(snapshot.nodes[0].config.cacheTtlSeconds).toBe(ttl)
  })

  it('does not overwrite an existing cache TTL', () => {
    const preset: TemplatePreset = {
      nodes: [
        {
          id: 'cache',
          type: 'cache',
          position: [0, 0, 0],
          label: 'Cache',
          config: { cacheStrategy: 'cache-aside', cacheTtlSeconds: 45 },
        },
      ],
      edges: [],
    }

    const snapshot = templatePresetToCanvasSnapshot(preset, 'url-shortener')
    expect(snapshot.nodes[0].config.cacheTtlSeconds).toBe(45)
  })
})
