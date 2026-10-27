import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/shared/ui/EmptyState'
import { describeActiveFilters } from '../domain/activeFilters'
import { countResults } from '../domain/facets'
import { applyFilterChange } from '../domain/urlState'
import type { ExplorerFilters, ExplorerIndex } from '../types'

/** Placeholder cards with the same footprint as real ones (no layout shift). */
export function ResultsSkeleton({ slow }: { slow: boolean }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-4">
      <span className="sr-only">Loading services…</span>
      {slow && <p className="text-sm text-muted-foreground">Still loading — this is taking longer than usual.</p>}
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} aria-hidden="true" className="rounded-lg border bg-card p-5 shadow-card">
          <div className="flex items-start gap-3">
            <Skeleton className="size-11 rounded-lg" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, j) => (
              <div key={j} className="grid gap-3 rounded-md border p-4">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-6 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

type EmptyResultsProps = {
  index: ExplorerIndex
  filters: ExplorerFilters
  onChange: (patch: Partial<ExplorerFilters>) => void
  onClearAll: () => void
}

/** No results: offer the removals that would bring results back, best first. */
export function EmptyResults({ index, filters, onChange, onClearAll }: EmptyResultsProps) {
  const suggestions = describeActiveFilters(filters, index)
    .map((filter) => ({
      filter,
      count: countResults(index.services, applyFilterChange(filters, filter.remove), index.subcategoryParents),
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  return (
    <EmptyState
      headingId="empty-title"
      title="No services match all of these filters"
      description={
        suggestions.length > 0 ? 'Try removing one of them:' : "Removing a single filter won't help. Start again with all services."
      }
    >
      {suggestions.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-2">
          {suggestions.map(({ filter, count }) => (
            <li key={filter.key}>
              <Button variant="secondary" onClick={() => onChange(filter.remove)} className="h-auto py-2 whitespace-normal">
                <X aria-hidden="true" />
                Remove “{filter.label}”
                <span className="font-normal text-muted-foreground"> — {count.toLocaleString('en-US')} results</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" onClick={onClearAll}>
        Clear all filters and search
      </Button>
    </EmptyState>
  )
}

/** What was hidden or adjusted in the data, and why (for reviewers and curious customers). */
export function DataNotes({ index }: { index: ExplorerIndex }) {
  if (index.issues.length === 0) return null
  return (
    <details className="mt-10 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
      <summary className="cursor-pointer font-semibold text-foreground">About this data ({index.issues.length} records adjusted)</summary>
      <p className="mt-3">
        Hidden from customers: {index.hidden.inactiveService} inactive services, {index.hidden.inactiveProvider} services from inactive
        providers, {index.hidden.inactiveCategory} services in inactive categories.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {index.issues.map((issue) => (
          <li key={`${issue.recordId}-${issue.issue}`}>
            <code className="rounded bg-muted px-1 text-xs">{issue.recordId}</code>: {issue.issue}. {issue.decision}.
          </li>
        ))}
      </ul>
    </details>
  )
}
