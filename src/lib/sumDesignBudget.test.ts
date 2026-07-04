import { describe, expect, it } from 'vitest'
import type { DeploymentDesign } from './deploymentTypes'
import { parseCpuMilli, parseMemoryBytes } from './k8sQuantity'
import { FALLBACK_RESOURCE_PROFILES } from './resourceProfileCatalogFallback'
import {
  designExceedsResourceQuota,
  sumDesignBudget,
} from './sumDesignBudget'

const catalog = FALLBACK_RESOURCE_PROFILES

function urlShortenerDefaultDesign(): DeploymentDesign {
  return {
    version: '1.0',
    template: 'url-shortener',
    archetype: 'url-shortener',
    nodes: [
      { id: 'lb-1', type: 'lb', name: 'Load Balancer', config: {} },
      {
        id: 'app-1',
        type: 'app-server',
        name: 'App Server',
        config: { replicas: 1, instanceSize: 'small' },
      },
      {
        id: 'cache-1',
        type: 'cache',
        name: 'Redis',
        config: { strategy: 'cache-aside' },
      },
      { id: 'db-1', type: 'db', name: 'PostgreSQL', config: {} },
    ],
    connections: [],
  }
}

function urlShortenerScaledLargeDesign(): DeploymentDesign {
  return {
    version: '1.0',
    template: 'url-shortener',
    archetype: 'url-shortener',
    nodes: [
      {
        id: 'lb-1',
        type: 'lb',
        name: 'Load Balancer',
        config: { instanceSize: 'large' },
      },
      {
        id: 'app-1',
        type: 'app-server',
        name: 'App Server',
        config: { replicas: 3, instanceSize: 'large' },
      },
      {
        id: 'cache-1',
        type: 'cache',
        name: 'Redis',
        config: { strategy: 'cache-aside', instanceSize: 'small' },
      },
      {
        id: 'db-1',
        type: 'db',
        name: 'PostgreSQL',
        config: { instanceSize: 'large' },
      },
    ],
    connections: [],
  }
}

describe('sumDesignBudget', () => {
  it('matches url-shortener default totals (875m / 1408Mi)', () => {
    const got = sumDesignBudget(urlShortenerDefaultDesign(), 'explorer', catalog)
    expect(parseCpuMilli(got.requested.cpu)).toBe(875)
    expect(parseMemoryBytes(got.requested.memory)).toBe(1408 * 1024 ** 2)
    expect(got.breakdown.some((row) => row.label === 'loadgen')).toBe(true)
  })

  it('flags default url-shortener as over explorer quota', () => {
    expect(
      designExceedsResourceQuota(urlShortenerDefaultDesign(), 'explorer', catalog),
    ).not.toBeNull()
  })

  it('passes scaled large design on architect tier', () => {
    expect(
      designExceedsResourceQuota(
        urlShortenerScaledLargeDesign(),
        'architect',
        catalog,
      ),
    ).toBeNull()
  })

  it('fails scaled large design on explorer tier', () => {
    expect(
      designExceedsResourceQuota(
        urlShortenerScaledLargeDesign(),
        'explorer',
        catalog,
      ),
    ).not.toBeNull()
  })

  it('uses mq component default (200m) not profile small', () => {
    const design: DeploymentDesign = {
      version: '1.0',
      template: 'social-feed',
      archetype: 'standard',
      nodes: [{ id: 'mq-1', type: 'mq', name: 'RabbitMQ', config: {} }],
      connections: [],
    }
    const got = sumDesignBudget(design, 'explorer', catalog)
    const mq = got.breakdown.find((row) => row.label === 'RabbitMQ')
    expect(mq?.cpu).toBe('200m')
  })
})
