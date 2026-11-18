import { describe, expect, it } from 'vitest'
import type { DeploymentDesign } from './deploymentTypes'
import { parseCpuMilli, parseMemoryBytes } from './k8sQuantity'
import { FALLBACK_RESOURCE_PROFILES } from './resourceProfileCatalogFallback'
import {
  canvasCapForTier,
  canvasQuotaForDisplay,
  designExceedsResourceQuota,
  sumDesignBudget,
  toResourceBudgetErrorResponse,
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
  it('matches url-shortener engineer preset totals (875m / 1152Mi)', () => {
    const got = sumDesignBudget(urlShortenerDefaultDesign(), 'explorer', catalog)
    expect(parseCpuMilli(got.requested.cpu)).toBe(875)
    expect(parseMemoryBytes(got.requested.memory)).toBe(1152 * 1024 ** 2)
    expect(got.breakdown.some((row) => row.label === 'loadgen')).toBe(true)
  })

  it('fits engineer url-shortener preset within explorer quota', () => {
    expect(
      designExceedsResourceQuota(urlShortenerDefaultDesign(), 'explorer', catalog),
    ).toBeNull()
  })

  it('matches explorer lite url-shortener totals (625m / 1024Mi)', () => {
    const got = sumDesignBudget(urlShortenerLiteDesign(), 'explorer', catalog)
    expect(parseCpuMilli(got.requested.cpu)).toBe(625)
    expect(parseMemoryBytes(got.requested.memory)).toBe(1024 * 1024 ** 2)
  })

  it('explorer lite url-shortener fits launch explorer cap', () => {
    expect(
      designExceedsResourceQuota(urlShortenerLiteDesign(), 'explorer', catalog),
    ).toBeNull()
    const got = sumDesignBudget(urlShortenerLiteDesign(), 'explorer', catalog)
    expect(got.cap.cpu).toBe('1075m')
    expect(got.cap.memory).toBe('2048Mi')
  })

  it('social-feed-pull lite fits explorer cap exactly', () => {
    expect(
      designExceedsResourceQuota(socialFeedPullLiteDesign(), 'explorer', catalog),
    ).toBeNull()
    const got = sumDesignBudget(socialFeedPullLiteDesign(), 'explorer', catalog)
    expect(parseCpuMilli(got.requested.cpu)).toBe(500)
    expect(parseMemoryBytes(got.requested.memory)).toBe(768 * 1024 ** 2)
  })

  it('counts postgres read replicas in explorer budget', () => {
    const design: DeploymentDesign = {
      ...socialFeedPullLiteDesign(),
      nodes: socialFeedPullLiteDesign().nodes.map((node) =>
        node.type === 'db'
          ? {
              ...node,
              config: { readReplicas: 2, instanceSize: 'small' },
            }
          : node,
      ),
    }
    const base = sumDesignBudget(socialFeedPullLiteDesign(), 'explorer', catalog)
    const withReplicas = sumDesignBudget(design, 'explorer', catalog)
    expect(parseCpuMilli(withReplicas.requested.cpu)).toBeGreaterThan(
      parseCpuMilli(base.requested.cpu),
    )
    expect(
      withReplicas.breakdown.some((row) => row.label.includes('PostgreSQL small×3')),
    ).toBe(true)
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

  it('charges app autoscale at max replicas', () => {
    const fixed = sumDesignBudget(
      {
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
        ],
        connections: [],
      },
      'internal',
      catalog,
    )
    const scaled = sumDesignBudget(
      {
        version: '1.0',
        template: 'url-shortener',
        archetype: 'url-shortener',
        nodes: [
          {
            id: 'app-1',
            type: 'app-server',
            name: 'App Server',
            config: {
              replicas: 1,
              instanceSize: 'small',
              autoscale: { min: 1, max: 5, targetCPUPercent: 70 },
            },
          },
        ],
        connections: [],
      },
      'internal',
      catalog,
    )
    const fixedApp = fixed.breakdown.find((row) => row.label.startsWith('App Server'))
    expect(scaled.breakdown.some((row) => row.label === 'App Server small×5')).toBe(
      true,
    )
    expect(fixedApp).toBeDefined()
    expect(parseCpuMilli(scaled.requested.cpu) - parseCpuMilli(fixed.requested.cpu)).toBe(
      parseCpuMilli(fixedApp!.cpu) * 4,
    )
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

describe('canvasQuotaForDisplay', () => {
  it('shows explorer lite url-shortener at canvas cap without loadgen row', () => {
    const session = sumDesignBudget(urlShortenerLiteDesign(), 'explorer', catalog)
    const display = canvasQuotaForDisplay(session, 'explorer')

    expect(parseCpuMilli(display.requested.cpu)).toBe(375)
    expect(parseMemoryBytes(display.requested.memory)).toBe(768 * 1024 ** 2)
    expect(display.cap.cpu).toBe('825m')
    expect(display.cap.memory).toBe('1792Mi')
    expect(display.breakdown.some((row) => row.label === 'loadgen')).toBe(false)
    expect(
      designExceedsResourceQuota(urlShortenerLiteDesign(), 'explorer', catalog),
    ).toBeNull()
  })

  it('flags medium app lite design over explorer canvas cap while session check matches API', () => {
    const mediumAppLite: DeploymentDesign = {
      ...urlShortenerLiteDesign(),
      nodes: urlShortenerLiteDesign().nodes.map((node) =>
        node.type === 'app-server'
          ? { ...node, config: { ...node.config, instanceSize: 'medium' } }
          : node,
      ),
    }
    const session = sumDesignBudget(mediumAppLite, 'explorer', catalog)
    const display = canvasQuotaForDisplay(session, 'explorer')

    expect(parseCpuMilli(session.requested.cpu)).toBe(750)
    expect(parseCpuMilli(display.requested.cpu)).toBe(500)
    expect(parseMemoryBytes(display.requested.memory)).toBe(1024 * 1024 ** 2)
    expect(display.cap.cpu).toBe('825m')
    expect(display.cap.memory).toBe('1792Mi')
    expect(
      designExceedsResourceQuota(mediumAppLite, 'explorer', catalog),
    ).toBeNull()
  })

  it('canvasCapForTier returns canvas-only caps per tier', () => {
    expect(canvasCapForTier('explorer')).toEqual({
      cpu: '825m',
      memory: '1792Mi',
    })
    expect(canvasCapForTier('engineer')).toEqual({
      cpu: '2875m',
      memory: '6400Mi',
    })
  })

  it('uses engineer and internal canvas caps for paid tiers', () => {
    const session = sumDesignBudget(urlShortenerLiteDesign(), 'engineer', catalog)
    const engineerDisplay = canvasQuotaForDisplay(session, 'engineer')
    const internalDisplay = canvasQuotaForDisplay(session, 'internal')

    expect(engineerDisplay.cap.cpu).toBe('2875m')
    expect(engineerDisplay.cap.memory).toBe('6400Mi')
    expect(internalDisplay.cap.cpu).toBe('3250m')
    expect(internalDisplay.cap.memory).toBe('7296Mi')
    expect(
      designExceedsResourceQuota(urlShortenerLiteDesign(), 'engineer', catalog),
    ).toBeNull()
    expect(
      designExceedsResourceQuota(urlShortenerLiteDesign(), 'internal', catalog),
    ).toBeNull()
  })

  it('maps 422 budget payloads to canvas-only numbers', () => {
    const session = sumDesignBudget(urlShortenerLiteDesign(), 'explorer', catalog)
    const apiBudget = toResourceBudgetErrorResponse(session)
    const display = canvasQuotaForDisplay(apiBudget, 'explorer')

    expect(display.breakdown.some((row) => row.label === 'loadgen')).toBe(false)
    expect(display.requested.cpu).toBe('375m')
    expect(display.cap.cpu).toBe('825m')
  })
})
