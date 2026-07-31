import type { EdgeSemanticClass } from './connectionSemantics'

export interface EdgeSemanticPaint {
  color: string
  dash?: string
  widthBoost?: number
  opacity?: number
}

export const SEMANTIC_INVALID_STROKE = '#b91c1c'

const PAINT_BY_CLASS: Record<Exclude<EdgeSemanticClass, 'neutral'>, EdgeSemanticPaint> =
  {
    active: { color: '#16a34a' },
    decorative: {
      color: 'var(--c9-text-muted)',
      dash: '6 4',
      opacity: 0.72,
    },
    unsupported: { color: '#d97706', dash: '6 4' },
    invalid: { color: SEMANTIC_INVALID_STROKE, widthBoost: 1 },
  }

export function paintForSemanticClass(
  semanticClass: EdgeSemanticClass,
): EdgeSemanticPaint | null {
  if (semanticClass === 'neutral') return null
  return PAINT_BY_CLASS[semanticClass]
}
