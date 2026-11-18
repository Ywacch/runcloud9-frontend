import { useEffect, useState } from 'react'
import { getTemplates } from '../lib/api'
import { buildTemplateLabFamilies, type TemplateLabFamily } from '../lib/templateLabRows'
import { FALLBACK_TEMPLATE_CATALOG } from '../lib/templateCatalogFallback'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'

export function useTemplateLabFamilies(): {
  families: TemplateLabFamily[]
  loading: boolean
  error: string | null
} {
  const [families, setFamilies] = useState<TemplateLabFamily[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
  const applyCatalog = (list: typeof FALLBACK_TEMPLATE_CATALOG) => {
      useTemplateRegistryStore.getState().mergeTemplates(list)
      setFamilies(buildTemplateLabFamilies(list))
    }

    if (import.meta.env.DEV) {
      applyCatalog(FALLBACK_TEMPLATE_CATALOG)
      setLoading(false)
      setError(null)
    } else {
      setLoading(true)
    }

    void getTemplates()
      .then((list) => {
        if (cancelled) return
        applyCatalog(list)
        setError(null)
      })
      .catch((e) => {
        if (!cancelled) {
          applyCatalog(FALLBACK_TEMPLATE_CATALOG)
          setError(
            e instanceof Error
              ? `${e.message} — using bundled templates`
              : 'Failed to load templates — using bundled templates',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { families, loading, error }
}