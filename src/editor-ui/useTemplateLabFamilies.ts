import { useEffect, useState } from 'react'
import { getTemplates } from '../lib/api'
import { buildTemplateLabFamilies, type TemplateLabFamily } from '../lib/templateLabRows'
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
    setLoading(true)
    getTemplates()
      .then((list) => {
        if (cancelled) return
        useTemplateRegistryStore.getState().mergeTemplates(list)
        setFamilies(buildTemplateLabFamilies(list))
        setError(null)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load templates')
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