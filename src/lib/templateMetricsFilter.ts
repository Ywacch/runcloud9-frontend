export const COMPONENT_METRIC_PREFIXES: Record<string, string[]> = {
  'app-server': ['feed.', 'posts.', 'checkout.', 'shortener.'],
  worker: ['worker.'],
  mq: ['mq.'],
}

export function getRelevantTemplateMetrics(
  templateMetrics: Record<string, number> | undefined,
  componentType: string
): Record<string, number> {
  if (!templateMetrics) return {}
  const prefixes = COMPONENT_METRIC_PREFIXES[componentType]
  if (!prefixes) return {}

  const filtered: Record<string, number> = {}
  for (const [key, value] of Object.entries(templateMetrics)) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      filtered[key] = value
    }
  }
  return filtered
}
