import { SlidersHorizontal, X } from 'lucide-react'
import { useId, type Ref } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/shared/ui/NativeSelect'
import { RefreshButton } from '@/shared/ui/RefreshButton'
import type { ActiveFilter } from '../domain/activeFilters'
import type { ExplorerFilters, SortKey } from '../types'

const SORT_LABELS: Record<SortKey, string> = {
  relevance: 'Relevance',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  rating: 'Rating',
}

type ResultsToolbarProps = {
  headingRef: Ref<HTMLHeadingElement>
  /** Announced to screen readers whenever it changes. */
  summary: string
  filterCount: number
  canOpenFilters: boolean
  onOpenFilters: () => void
  sort: SortKey
  onSortChange: (sort: SortKey) => void
}

/** Results heading, live result count, Refresh, mobile "Filters" button and sort order. */
export function ResultsToolbar({ headingRef, summary, filterCount, canOpenFilters, onOpenFilters, sort, onSortChange }: ResultsToolbarProps) {
  const sortId = useId()
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2
          id="results-heading"
          ref={headingRef}
          tabIndex={-1}
          className="scroll-mt-24 text-lg font-semibold focus:outline-none focus-visible:outline-2"
        >
          Results
        </h2>
        <p role="status" aria-live="polite" aria-atomic="true" className="min-h-5 text-sm text-muted-foreground tabular-nums">
          {summary}
        </p>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        {/* Re-fetches the services; the filters in the URL are applied to the fresh data. */}
        <RefreshButton queryKey={['explorer']} />
        <Button variant="outline" className="lg:hidden" onClick={onOpenFilters} disabled={!canOpenFilters} aria-haspopup="dialog">
          <SlidersHorizontal aria-hidden="true" />
          {filterCount ? `Filters (${filterCount})` : 'Filters'}
        </Button>
        <div className="flex flex-1 items-center gap-2 sm:flex-none">
          <Label htmlFor={sortId} className="shrink-0 font-normal text-muted-foreground">
            Sort by
          </Label>
          <NativeSelect id={sortId} className="flex-1 sm:w-48" value={sort} onChange={(e) => onSortChange(e.target.value as SortKey)}>
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
    </div>
  )
}

/** Removable chips for every active filter. */
export function ActiveFilterChips({ filters, onRemove }: { filters: ActiveFilter[]; onRemove: (patch: Partial<ExplorerFilters>) => void }) {
  if (filters.length === 0) return null
  return (
    <ul aria-label="Active filters" className="mb-4 flex flex-wrap gap-2">
      {filters.map((filter) => (
        <li key={filter.key}>
          <button
            type="button"
            onClick={() => onRemove(filter.remove)}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-primary/25 bg-secondary px-3 py-1 text-left text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent"
          >
            {filter.label}
            <X aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="sr-only"> — remove filter</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
