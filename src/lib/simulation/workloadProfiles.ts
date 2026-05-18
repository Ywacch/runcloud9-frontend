import type { WorkloadProfile } from './workload'

const URL_SHORTENER_CODES = [
  'x7k2m',
  'a9p3q',
  'b4n8r',
  'c2j5s',
  'd6h1t',
  'e8f4u',
  'g3w7v',
  'h5y2w',
  'j1z6x',
  'k9a4y',
  'm2b8z',
  'n7c3a',
  'p4d9b',
  'q8e5c',
  'r3f1d',
  's6g7e',
  't1h2f',
  'u5i8g',
  'v9j4h',
  'w2k0i',
]

export const WORKLOAD_BY_TEMPLATE_ID: Record<string, WorkloadProfile> = {
  'url-shortener': {
    readLabel: 'Redirects',
    writeLabel: 'Shortens',
    archetypes: [
      {
        id: 'redirect-lookup',
        label: 'Redirect lookup',
        method: 'read',
        weight: 0.95,
        cacheKeyPattern: 'redirect:{id}',
        sampleIds: URL_SHORTENER_CODES,
        sampleData: [
          { id: 'x7k2m', preview: 'https://github.com/...' },
          { id: 'a9p3q', preview: 'https://youtube.com/...' },
          { id: 'b4n8r', preview: 'https://news.ycombinator.com/...' },
        ],
        dbLabel: 'SELECT url FROM urls WHERE code = ?',
      },
      {
        id: 'shorten-url',
        label: 'Create short URL',
        method: 'write',
        weight: 0.05,
        cacheKeyPattern: 'redirect:{id}',
        sampleIds: URL_SHORTENER_CODES,
        dbLabel: 'INSERT INTO urls (code, url) VALUES (?, ?)',
      },
    ],
  },
  ecommerce: {
    readLabel: 'Catalog & search',
    writeLabel: 'Cart & orders',
    archetypes: [
      {
        id: 'product-detail',
        label: 'Product page',
        method: 'read',
        weight: 0.42,
        cacheKeyPattern: 'product:{id}',
        sampleIds: ['sku-1001', 'sku-2044', 'sku-8821'],
        dbLabel: 'SELECT * FROM products WHERE id = ?',
      },
      {
        id: 'search',
        label: 'Search / list',
        method: 'read',
        weight: 0.28,
        cacheKeyPattern: 'search:{q}',
        sampleIds: ['laptop', 'desk', 'usb-c hub'],
        dbLabel: 'SELECT id, title FROM products WHERE tsvector @@ ?',
      },
      {
        id: 'cart-update',
        label: 'Cart mutations',
        method: 'write',
        weight: 0.18,
        cacheKeyPattern: 'cart:{userId}',
        sampleIds: ['u-1', 'u-2', 'u-3'],
        dbLabel: 'UPDATE carts SET items = ? WHERE user_id = ?',
      },
      {
        id: 'checkout',
        label: 'Checkout / payment',
        method: 'write',
        weight: 0.12,
        cacheKeyPattern: 'order:{id}',
        sampleIds: ['ord-9a2', 'ord-7ff', 'ord-331'],
        dbLabel: 'INSERT INTO orders (user_id, total) VALUES (?, ?)',
      },
    ],
  },
  'social-feed': {
    readLabel: 'Feed & reads',
    writeLabel: 'Posts & engagement',
    archetypes: [
      {
        id: 'home-feed',
        label: 'Home feed',
        method: 'read',
        weight: 0.5,
        cacheKeyPattern: 'feed:{userId}:home',
        sampleIds: ['u-aa', 'u-bb', 'u-cc'],
        dbLabel: 'SELECT post_id FROM feed WHERE user_id = ? LIMIT 50',
      },
      {
        id: 'notifications',
        label: 'Notifications',
        method: 'read',
        weight: 0.22,
        cacheKeyPattern: 'notif:{userId}',
        sampleIds: ['u-aa', 'u-bb'],
        dbLabel: 'SELECT * FROM notifications WHERE user_id = ?',
      },
      {
        id: 'create-post',
        label: 'Create post',
        method: 'write',
        weight: 0.15,
        cacheKeyPattern: 'post:{id}',
        sampleIds: ['p-001', 'p-002'],
        dbLabel: 'INSERT INTO posts (author_id, body) VALUES (?, ?)',
      },
      {
        id: 'reaction',
        label: 'Like / react',
        method: 'write',
        weight: 0.13,
        cacheKeyPattern: 'react:{postId}:{userId}',
        sampleIds: ['p-001', 'p-002'],
        dbLabel: 'INSERT INTO reactions (post_id, user_id, kind) VALUES (?, ?, ?)',
      },
    ],
  },
}

export function workloadProfileForTemplate(
  templateId: string | null | undefined
): WorkloadProfile | undefined {
  if (!templateId) return undefined
  const resolved =
    templateId === 'social-feed-pull' ? 'social-feed' : templateId
  const p = WORKLOAD_BY_TEMPLATE_ID[resolved]
  if (!p || p.archetypes.length === 0) return undefined
  return p
}
