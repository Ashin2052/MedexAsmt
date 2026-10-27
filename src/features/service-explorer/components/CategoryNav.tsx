import { LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FacetCounts } from '../domain/facets'
import { SERVICE_TYPES, SERVICE_TYPE_LABELS, type ServiceType } from '../types'
import { ServiceTypeIcon } from '@/shared/ui/ServiceTypeIcon'

type CategoryNavProps = {
  selected: ServiceType[]
  counts: FacetCounts['type']
  onSelect: (types: ServiceType[]) => void
}

/**
 * Quick browsing by service type: a shortcut onto the "Service type" facet
 * (same URL state). Counts come from the same facet engine.
 */
export function CategoryNav({ selected, counts, onSelect }: CategoryNavProps) {
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0)
  const items: { key: string; label: string; count: number; pressed: boolean; types: ServiceType[] }[] = [
    { key: 'all', label: 'All services', count: total, pressed: selected.length === 0, types: [] },
    ...SERVICE_TYPES.map((type) => ({
      key: type,
      label: SERVICE_TYPE_LABELS[type],
      count: counts.get(type) ?? 0,
      pressed: selected.length === 1 && selected[0] === type,
      types: [type],
    })),
  ]

  return (
    <div role="group" aria-label="Browse by service type" className="relative -mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2">
        {items.map(({ key, label, count, pressed, types }) => (
          <li key={key}>
            <button
              type="button"
              aria-pressed={pressed}
              disabled={count === 0 && !pressed}
              onClick={() => onSelect(types)}
              className={cn(
                'flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap shadow-xs transition-colors disabled:opacity-50',
                pressed
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card text-foreground hover:border-primary/40 hover:bg-accent',
              )}
            >
              {key === 'all' ? (
                <LayoutGrid aria-hidden="true" className="size-4" />
              ) : (
                <ServiceTypeIcon type={key} aria-hidden="true" className="size-4" />
              )}
              {label}
              <span className={cn('text-xs tabular-nums', pressed ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                <span className="sr-only">, </span>
                {count.toLocaleString('en-US')}
                <span className="sr-only"> results</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
