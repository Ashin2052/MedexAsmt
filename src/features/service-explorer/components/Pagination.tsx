import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { visiblePages } from '../domain/grouping'

type PaginationProps = {
  page: number
  pageCount: number
  onChange: (page: number) => void
}

export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  if (pageCount <= 1) return null
  return (
    <nav aria-label="Result pages" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      <Button variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Previous</span>
        <span className="sr-only"> page</span>
      </Button>
      <ul className="flex items-center gap-1">
        {visiblePages(page, pageCount).map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={p}>
              <Button
                variant={p === page ? 'default' : 'ghost'}
                size="icon"
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onChange(p)}
                className="tabular-nums"
              >
                <span className="sr-only">Page </span>
                {p}
              </Button>
            </li>
          ),
        )}
      </ul>
      <Button variant="outline" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
        <span className="sr-only sm:not-sr-only">Next</span>
        <span className="sr-only"> page</span>
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  )
}
