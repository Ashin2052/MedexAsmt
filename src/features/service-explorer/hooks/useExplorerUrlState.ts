import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { applyFilterChange, parseFilters, serializeFilters } from '../domain/urlState'
import type { ExplorerFilters } from '../types'

type UpdateFilters = (patch: Partial<ExplorerFilters>, options?: { replace?: boolean }) => void

/**
 * Filters, sort and page read from and written to the URL. Each committed
 * change is a history entry, so back/forward step through views.
 */
export function useExplorerUrlState() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(searchParams), [searchParams])

  const update: UpdateFilters = useCallback(
    (patch, options) => {
      setSearchParams((current) => serializeFilters(applyFilterChange(parseFilters(current), patch)), {
        replace: options?.replace ?? false,
      })
    },
    [setSearchParams],
  )

  /** Replace the whole filter state (mobile drawer "Show results", "Clear all"). */
  const replaceAll = useCallback(
    (next: ExplorerFilters, options?: { replace?: boolean }) => {
      setSearchParams(serializeFilters(next), { replace: options?.replace ?? false })
    },
    [setSearchParams],
  )

  return { filters, update, replaceAll }
}
