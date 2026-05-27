import type { CanvasNode } from '../editor-core/stores/canvasStore'

export interface RationaleEntry {
  title: string
  body: string
  /** Canvas node type — first matching node is selected when the card opens. */
  highlight?: CanvasNode['type']
}

export const RATIONALE: Record<string, RationaleEntry[]> = {
  'url-shortener': [
    {
      title: 'Why Cache-Aside?',
      body: 'URL shorteners are read-heavy — most requests are redirects (GET /{code}), not URL creation (POST /shorten). Cache-aside lets the app check Redis first. On a cache hit, PostgreSQL is never touched. On a miss, the app queries the DB and populates the cache for next time.',
      highlight: 'cache',
    },
    {
      title: 'Why PostgreSQL?',
      body: 'Short code → URL mapping is a simple key-value lookup, but we use a relational DB because: (1) it guarantees uniqueness via constraints, (2) it supports deduplication queries, (3) it models the real-world pattern where the DB is the source of truth and the cache is derived.',
      highlight: 'database',
    },
    {
      title: 'The Bottleneck',
      body: `Watch what happens at high RPS when the cache hit rate drops. Every cache miss becomes a DB query. If the DB can handle 200 queries/sec but the app receives 5000 req/sec with a 50% hit rate, that's 2500 DB queries/sec — 12.5x over capacity. This is "cache miss amplification."`,
    },
    {
      title: 'Load Balancer Role',
      body: 'The LB distributes traffic across app server replicas. Try switching the algorithm from round-robin to least-connections and watch the backend distribution change.',
      highlight: 'load_balancer',
    },
  ],
  ecommerce: [
    {
      title: 'Coming Soon',
      body: 'E-commerce template rationale will be added when the template becomes deployable.',
    },
  ],
  'social-feed': [
    {
      title: 'Coming Soon',
      body: 'Social feed template rationale will be added when the template becomes deployable.',
    },
  ],
}
