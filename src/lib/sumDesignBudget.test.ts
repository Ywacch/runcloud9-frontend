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

function urlShortenerLiteDesign(): DeploymentDesign {
  return {
    version: '1.0',
    template: 'url-shortener',
    archetype: 'url-shortener',
    nodes: [
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

function socialFeedPullLiteDesign(): DeploymentDesign {
  return {
    version: '1.0',
    template: 'social-feed-pull',
    archetype: 'standard',
    nodes: [
      {
        id: 'app-1',
        type: 'app-server',
        name: 'App Server',
        config: { replicas: 1, instanceSize: 'small' },
      },
      { id: 'db-1', type: 'db', name: 'PostgreSQL', config: {} },
    ],
    connections: [],
  }
}

describe('sumDesignBudget', () => {
  it('matches url-shortener engineer preset totals (875m / 1408Mi)', () => {
    const got = sumDesignBudget(urlShortenerDefaultDesign(), 'explorer', catalog)
    expect(parseCpuMilli(got.requested.cpu)).toBe(875)
    expect(parseMemoryBytes(got.requested.memory)).toBe(1408 * 1024 ** 2)
    expect(got.breakdown.some((row) => row.label === 'loadgen')).toBe(true)
  })

  it('flags engineer url-shortener preset as over explorer quota', () => {
    expect(
      designExceedsResourceQuota(urlShortenerDefaultDesign(), 'explorer', catalog),
    ).not.toBeNull()
  })

  it('matches explorer lite url-shortener totals (625m / 1280Mi)', () => {
    const got = sumDesignBudget(urlShortenerLiteDesign(), 'explorer', catalog)
    expect(parseCpuMilli(got.requested.cpu)).toBe(625)
    expect(parseMemoryBytes(got.requested.memory)).toBe(1280 * 1024 ** 2)
  })

  it('explorer lite url-shortener fits raised explorer cap', () => {
    expect(
      designExceedsResourceQuota(urlShortenerLiteDesign(), 'explorer', catalog),
    ).toBeNull()
    const got = sumDesignBudget(urlShortenerLiteDesign(), 'explorer', catalog)
    expect(got.cap.cpu).toBe('625m')
    expect(got.cap.memory).toBe('1280Mi')
  })

  it('social-feed-pull lite fits explorer cap exactly', () => {
    expect(
      designExceedsResourceQuota(socialFeedPullLiteDesign(), 'explorer', catalog),
    ).toBeNull()
    const got = sumDesignBudget(socialFeedPullLiteDesign(), 'explorer', catalog)
    expect(parseCpuMilli(got.requested.cpu)).toBe(500)
    expect(parseMemoryBytes(got.requested.memory)).toBe(1024 * 1024 ** 2)
  })

  it('uses engineer caps when tier is engineer', () => {
    const got = sumDesignBudget(urlShortenerLiteDesign(), 'engineer', catalog)
    expect(got.cap.cpu).toBe('3375m')
    expect(got.cap.memory).toBe('6912Mi')
    expect(
      designExceedsResourceQuota(urlShortenerLiteDesign(), 'engineer', catalog),
    ).toBeNull()
  })

  it('uses internal caps when tier is internal', () => {
    const got = sumDesignBudget(urlShortenerLiteDesign(), 'internal', catalog)
    expect(got.cap.cpu).toBe('4250m')
    expect(got.cap.memory).toBe('8320Mi')
    expect(
      designExceedsResourceQuota(urlShortenerLiteDesign(), 'internal', catalog),
    ).toBeNull()
  })

  it('engineer url-shortener preset fits raised engineer cap', () => {
    expect(
      designExceedsResourceQuota(urlShortenerDefaultDesign(), 'engineer', catalog),
    ).toBeNull()
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

  it('adds cache-proxy overhead for write-through using proxy size table', () => {
    const design: DeploymentDesign = {
      version: '1.0',
      template: 'url-shortener',
      archetype: 'url-shortener',
      nodes: [
        {
          id: 'cache-1',
          type: 'cache',
          name: 'Redis',
          config: {
            strategy: 'write-through',
            instanceSize: 'small',
          },
        },
      ],
      connections: [],
    }
    const got = sumDesignBudget(design, 'engineer', catalog)
    const redis = got.breakdown.find((row) => row.label === 'Redis')
    const proxy = got.breakdown.find((row) => row.label === 'Redis cache-proxy')
    expect(redis?.cpu).toBe('125m')
    expect(redis?.memory).toBe('256Mi')
    // Default proxy for Redis small → proxy small = 250m / 512Mi
    expect(proxy?.cpu).toBe('250m')
    expect(proxy?.memory).toBe('512Mi')
  })

  it('uses explicit proxyInstanceSize for budget independent of Redis size', () => {
    const design: DeploymentDesign = {
      version: '1.0',
      template: 'url-shortener',
      archetype: 'url-shortener',
      nodes: [
        {
          id: 'cache-1',
          type: 'cache',
          name: 'Redis',
          config: {
            cacheStrategy: 'write-behind',
            instanceSize: 'large',
            proxyInstanceSize: 'small',
          },
        },
      ],
      connections: [],
    }
    const got = sumDesignBudget(design, 'engineer', catalog)
    const proxy = got.breakdown.find((row) => row.label === 'Redis cache-proxy')
    expect(proxy?.cpu).toBe('250m')
    expect(proxy?.memory).toBe('512Mi')
  })

  it('does not add cache-proxy line for cache-aside', () => {
    const design: DeploymentDesign = {
      version: '1.0',
      template: 'url-shortener',
      archetype: 'url-shortener',
      nodes: [
        {
          id: 'cache-1',
          type: 'cache',
          name: 'Redis',
          config: { strategy: 'cache-aside', instanceSize: 'small' },
        },
      ],
      connections: [],
    }
    const got = sumDesignBudget(design, 'explorer', catalog)
    expect(
      got.breakdown.some((row) => row.label.includes('cache-proxy')),
    ).toBe(false)
  })

  it('sums per-copy app sizes instead of replicas times one profile', () => {
    const mixed: DeploymentDesign = {
      version: '1.0',
      template: 'url-shortener',
      archetype: 'url-shortener',
      nodes: [
        {
          id: 'app-1',
          type: 'app-server',
          name: 'App Server',
          config: {
            replicas: 2,
            instanceSize: 'large',
            instanceSizes: ['large', 'small'],
          },
        },
      ],
      connections: [],
    }
    const uniformLarge: DeploymentDesign = {
      ...mixed,
      nodes: [
        {
          id: 'app-1',
          type: 'app-server',
          name: 'App Server',
          config: { replicas: 2, instanceSize: 'large' },
        },
      ],
    }
    const mixedBudget = sumDesignBudget(mixed, 'explorer', catalog)
    const twoLargeBudget = sumDesignBudget(uniformLarge, 'explorer', catalog)
    expect(mixedBudget.cpuMilli).toBeLessThan(twoLargeBudget.cpuMilli)
  })
})
