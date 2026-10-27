import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { evaluateExplorer } from '../domain/facets'
import { applyFilterChange } from '../domain/urlState'
import { DEFAULT_FILTERS, type ExplorerFilters, type ExplorerIndex } from '../types'
import { FilterPanel } from './FilterPanel'

type FilterDrawerProps = {
  open: boolean
  index: ExplorerIndex
  filters: ExplorerFilters
  onApply: (next: ExplorerFilters) => void
  onClose: () => void
}

/**
 * Mobile filters in a modal sheet (focus is contained, the page behind is
 * inert, Escape closes, focus returns to the trigger). Changes are a draft
 * until "Show results"; the button states how many results the pending
 * selection would produce.
 */
export function FilterDrawer({ open, index, filters, onApply, onClose }: FilterDrawerProps) {
  const [draft, setDraft] = useState(filters)
  const [wasOpen, setWasOpen] = useState(open)

  // Start each opening from the committed filters.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft(filters)
  }

  const evaluation = useMemo(
    () => evaluateExplorer(index.services, draft, index.subcategoryParents),
    [index, draft],
  )
  const total = evaluation.results.length

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Changes apply when you press “Show results”.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <FilterPanel
            index={index}
            filters={draft}
            counts={evaluation.counts}
            onChange={(patch) => setDraft((current) => applyFilterChange(current, patch))}
          />
        </div>
        <SheetFooter className="flex-row border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" size="lg" onClick={() => setDraft({ ...DEFAULT_FILTERS, q: draft.q, sort: draft.sort })}>
            Clear filters
          </Button>
          <Button size="lg" className="flex-1 tabular-nums" onClick={() => onApply(draft)} aria-live="polite">
            {total === 0 ? 'No results — adjust filters' : `Show ${total.toLocaleString('en-US')} results`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
