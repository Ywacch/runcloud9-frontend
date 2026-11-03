/** Example keys students can try when the metadump list is empty. */

export function memcachedExampleKeys(patterns: readonly string[]): string[] {
  const out: string[] = []
  for (const raw of patterns) {
    const p = raw.trim()
    if (!p || p === '*') continue
    if (!p.includes('*') && !p.includes('?') && !p.includes('[')) {
      out.push(p)
      continue
    }
    if (p.endsWith(':*')) {
      out.push(`${p.slice(0, -1)}1`)
    }
  }
  return [...new Set(out)]
}

export function memcachedEmptyKeysMessage(
  templateId: string | null | undefined,
  patterns: readonly string[],
): string {
  const examples = memcachedExampleKeys(patterns)
  const exampleBit =
    examples.length > 0
      ? ` After traffic, try ${examples.slice(0, 3).join(', ')}.`
      : ''
  const id = (templateId ?? '').trim()
  if (id === 'ecommerce') {
    return `No whitelisted keys in this dump yet. Run load or hit GET /catalog so the app warms the cache.${exampleBit}`
  }
  if (id === 'url-shortener') {
    return `No keys in this dump yet. Run load or open GET /r/{code} so a miss stores a short code.${exampleBit}`
  }
  return `No keys in this dump yet. Run load on cache-aside routes first.${exampleBit}`
}
