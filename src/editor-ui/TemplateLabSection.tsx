import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import {
  TEMPLATE_COMING_SOON_HINT,
  templateCanLoadInPicker,
} from '../lib/templateAvailability'
import type { TemplateLabFamily, TemplateLabVariationRow } from '../lib/templateLabRows'
import { familyMetaForKey } from '../lib/templateFamilyMeta'
import type { TemplateFamilyId } from '../lib/templateFamilyCatalog'
import type { TemplateSelectAction } from './TemplateModal'
import { useTemplateLabFamilies } from './useTemplateLabFamilies'
import {
  clearTemplateFloorPreview,
  useTemplateLabPreviewActions,
  variationRowKey,
} from './templateLabPreview'

type Props = {
  disabled?: boolean
  /** When omitted, follows `disabled`. Simulate allows hover preview while placement stays off. */
  previewDisabled?: boolean
  loadedVariationId: string | null
  snapshotTemplateId: string | null
  onPlace: (action: TemplateSelectAction) => boolean | void
}

function isFinePointer(e: PointerEvent): boolean {
  return e.pointerType !== 'touch'
}

export function TemplateLabSection({
  disabled,
  previewDisabled: previewDisabledProp,
  loadedVariationId,
  snapshotTemplateId,
  onPlace,
}: Props) {
  const previewDisabled = previewDisabledProp ?? Boolean(disabled)
  const { families, loading, error } = useTemplateLabFamilies()
  const [openFamilyId, setOpenFamilyId] = useState<TemplateFamilyId | null>(null)
  const [rovingId, setRovingId] = useState<string | null>(null)
  const treeRef = useRef<HTMLUListElement>(null)
  const ghostTimerRef = useRef<number>(0)
  const hideTimerRef = useRef<number>(0)

  const { showPreview, clearPreview, isGhostRow } = useTemplateLabPreviewActions(
    previewDisabled,
    loadedVariationId,
    snapshotTemplateId,
  )

  useEffect(() => {
    return () => clearTemplateFloorPreview()
  }, [])

  const selectedKey =
    snapshotTemplateId && loadedVariationId
      ? `${snapshotTemplateId}:${loadedVariationId}`
      : null

  const wantGhost = useCallback(
    (row: TemplateLabVariationRow | null) => {
      window.clearTimeout(hideTimerRef.current)
      window.clearTimeout(ghostTimerRef.current)
      ghostTimerRef.current = window.setTimeout(() => {
        showPreview(row)
      }, 60)
    },
    [showPreview],
  )

  const wantHide = useCallback(() => {
    window.clearTimeout(ghostTimerRef.current)
    window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => {
      clearPreview()
    }, 90)
  }, [clearPreview])

  const visibleTreeIds = useCallback((): string[] => {
    const ids: string[] = []
    for (const item of families) {
      ids.push(`lab:${item.family.id}`)
      if (openFamilyId === item.family.id) {
        for (const row of item.allVariations) {
          ids.push(`var:${variationRowKey(row)}`)
        }
      }
    }
    return ids
  }, [families, openFamilyId])

  const focusTreeId = (id: string | null) => {
    if (!id || !treeRef.current) return
    const el = treeRef.current.querySelector<HTMLElement>(`[data-tree-id="${id}"]`)
    el?.focus()
    setRovingId(id)
  }

  const placeRow = useCallback(
    (row: TemplateLabVariationRow) => {
      if (!templateCanLoadInPicker(row)) return false
      clearPreview()
      return onPlace({
        kind: 'preset',
        id: row.templateId,
        variationId: row.variationId,
        preset: () => row.snapshot,
      })
    },
    [clearPreview, onPlace],
  )

  const toggleLab = (familyId: TemplateFamilyId) => {
    setOpenFamilyId((cur) => (cur === familyId ? null : familyId))
    setRovingId(`lab:${familyId}`)
  }

  const onTreeKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
  const treeItem = target.closest<HTMLElement>('[data-tree-id]')
    if (!treeItem || !treeRef.current?.contains(treeItem)) return
    const id = treeItem.getAttribute('data-tree-id')
    if (!id) return
    const list = visibleTreeIds()
    const index = list.indexOf(id)
    if (index < 0) return

    const isLab = id.startsWith('lab:')
    const familyId = isLab ? id.slice(4) : null

    let next: string | null = null
    switch (e.key) {
      case 'ArrowDown':
        next = list[index + 1] ?? null
        break
      case 'ArrowUp':
        next = list[index - 1] ?? null
        break
      case 'Home':
        next = list[0] ?? null
        break
      case 'End':
        next = list[list.length - 1] ?? null
        break
      case 'ArrowRight':
        if (isLab && familyId) {
          if (openFamilyId !== familyId) {
            setOpenFamilyId(familyId as TemplateFamilyId)
            e.preventDefault()
            return
          }
          const firstVar = list.find((x) => x.startsWith('var:'))
          next = firstVar ?? null
        }
        break
      case 'ArrowLeft':
        if (isLab && familyId && openFamilyId === familyId) {
          setOpenFamilyId(null)
          e.preventDefault()
          return
        }
        if (!isLab) {
          const row = families
            .flatMap((f) => f.allVariations)
            .find((r) => `var:${variationRowKey(r)}` === id)
          if (row) {
            const fam = families.find((f) =>
              f.allVariations.some((v) => variationRowKey(v) === variationRowKey(row)),
            )
            if (fam) next = `lab:${fam.family.id}`
          }
        }
        break
      case 'Enter':
      case ' ': {
        e.preventDefault()
        if (isLab && familyId) {
          toggleLab(familyId as TemplateFamilyId)
          return
        }
        const row = families
          .flatMap((f) => f.allVariations)
          .find((r) => `var:${variationRowKey(r)}` === id)
        if (row) placeRow(row)
        return
      }
      default:
        return
    }
    e.preventDefault()
    if (next) focusTreeId(next)
  }

  const previewFromTreeId = (treeId: string) => {
    if (treeId.startsWith('var:')) {
      const key = treeId.slice(4)
      const row = families
        .flatMap((f) => f.allVariations)
        .find((r) => variationRowKey(r) === key)
      wantGhost(row ?? null)
      return
    }
    if (treeId.startsWith('lab:')) {
      const familyId = treeId.slice(4) as TemplateFamilyId
      const item = families.find((f) => f.family.id === familyId)
      const first = item?.variations[0] ?? item?.allVariations[0]
      wantGhost(first ?? null)
    }
  }

  const handleTreePointerOver = (e: PointerEvent) => {
    if (!isFinePointer(e)) return
    window.clearTimeout(hideTimerRef.current)
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tree-id]')
    const treeId = el?.getAttribute('data-tree-id')
    if (!treeId || !treeRef.current?.contains(el)) return
    previewFromTreeId(treeId)
  }

  const handleTreeFocusIn = (e: FocusEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tree-id]')
    const treeId = el?.getAttribute('data-tree-id')
    if (!treeId) return
    setRovingId(treeId)
    previewFromTreeId(treeId)
  }

  const handleTreeFocusOut = (e: FocusEvent) => {
    const next = e.relatedTarget
    if (next instanceof Node && treeRef.current?.contains(next)) return
    wantHide()
  }

  if (loading) {
    return <p className="cv-note">Loading labs…</p>
  }
  if (error) {
    return <p className="cv-note">{error}</p>
  }

  return (
    <>
      <p className="sr-only" id="labs-hint">
        Arrow keys move through labs and variations. Focus or hover previews a
        layout on the floor. Enter places it.
      </p>
      <ul
        ref={treeRef}
        id="labs"
        className="cv-tree"
        role="tree"
        aria-labelledby="h-layout"
        aria-describedby="labs-hint"
        onKeyDown={onTreeKeyDown}
        onPointerOver={handleTreePointerOver}
        onPointerLeave={(e) => {
          if (isFinePointer(e)) wantHide()
        }}
        onFocus={handleTreeFocusIn}
        onBlurCapture={handleTreeFocusOut}
      >
        {families.map((item) => {
          const meta = familyMetaForKey(item.family.metaKey)
          const isOpen = openFamilyId === item.family.id
          const labTreeId = `lab:${item.family.id}`
          return (
            <li
              key={item.family.id}
              role="treeitem"
              aria-expanded={isOpen}
              aria-label={item.family.title}
              data-tree-id={labTreeId}
            >
              <button
                type="button"
                className="cv-lab-row"
                data-tree-id={labTreeId}
                tabIndex={rovingId === labTreeId || (!rovingId && families[0] === item) ? 0 : -1}
                disabled={disabled}
                onClick={() => toggleLab(item.family.id)}
              >
                <span className="cv-lab-icon" style={{ color: meta.accent }}>
                  {meta.icon}
                </span>
                <span className="cv-lab-t">
                  <b>{item.family.title}</b>
                </span>
                <i className="cv-chev" aria-hidden />
              </button>
              {isOpen ? (
                <ul role="group">
                  {item.allVariations.map((row) => {
                    const rowKey = variationRowKey(row)
                    const varTreeId = `var:${rowKey}`
                    const loadable = templateCanLoadInPicker(row)
                    const selected = selectedKey === rowKey
                    const ghost = isGhostRow(row)
                    return (
                      <li
                        key={rowKey}
                        role="treeitem"
                        className={`cv-var${ghost ? ' is-ghost' : ''}`}
                        data-tree-id={varTreeId}
                        tabIndex={rovingId === varTreeId ? 0 : -1}
                        aria-selected={selected}
                        aria-disabled={!loadable || disabled}
                        title={
                          !loadable
                            ? TEMPLATE_COMING_SOON_HINT
                            : row.variationDescription
                        }
                        onClick={() => {
                          if (!loadable || disabled) return
                          placeRow(row)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            if (!loadable || disabled) return
                            placeRow(row)
                          }
                        }}
                      >
                        <b>{row.variationLabel}</b>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </>
  )
}

export type { TemplateLabFamily, TemplateLabVariationRow }