import type { ReactNode } from 'react'
import type { TemplateFamilyId } from './templateFamilyCatalog'

export type TemplateFamilyMeta = {
  icon: ReactNode
  accent: string
}

const iconClass = 'h-4 w-4 shrink-0'

const LinkIcon = (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
)

const CartIcon = (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M6 6h15l-1.5 9h-12L4.5 6H2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="9" cy="20" r="1.5" fill="currentColor" />
    <circle cx="18" cy="20" r="1.5" fill="currentColor" />
  </svg>
)

const UsersIcon = (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm12-4v6m-3-3h6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
)

export const TEMPLATE_FAMILY_META: Record<string, TemplateFamilyMeta> = {
  'url-shortener': {
    accent: 'var(--sl-green)',
    icon: LinkIcon,
  },
  ecommerce: {
    accent: 'var(--sl-green)',
    icon: CartIcon,
  },
  'social-feed': {
    accent: 'var(--sl-amber)',
    icon: UsersIcon,
  },
}

export function familyMetaForKey(metaKey: string): TemplateFamilyMeta {
  return (
    TEMPLATE_FAMILY_META[metaKey] ?? {
      accent: 'var(--sl-ink-2)',
      icon: UsersIcon,
    }
  )
}

export function familyMetaForId(id: TemplateFamilyId): TemplateFamilyMeta {
  return familyMetaForKey(id)
}