import { useQuery } from '@tanstack/react-query'
import { Info, Search, SlidersHorizontal } from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { describeApiError } from '@/shared/api/client'
import { useDelayedFlag } from '@/shared/lib/useDelayedFlag'
import { ErrorState } from '@/shared/ui/ErrorState'
import { OfflineBanner } from '@/shared/ui/OfflineBanner'
import { PageContainer } from '@/shared/ui/PageContainer'
import { describeActiveFilters } from '../domain/activeFilters'
import { evaluateExplorer } from '../domain/facets'
import { clampPage, groupAndSort, pageCount as countPages, paginate } from '../domain/grouping'
import { activeFilterCount, canonicalizeFilters, filtersEqual } from '../domain/urlState'
import { fetchExplorerIndex } from '../api/explorerApi'
import { useExplorerUrlState } from '../hooks/useExplorerUrlState'
import { useSearchInput } from '../hooks/useSearchInput'
import { DEFAULT_FILTERS, type ExplorerFilters } from '../types'
import { CategoryNav } from './CategoryNav'
import { FilterDrawer } from './FilterDrawer'
import { FilterPanel } from './FilterPanel'
import { Pagination } from './Pagination'
import { ProviderCard } from './ProviderCard'
import { DataNotes, EmptyResults, ResultsSkeleton } from './ResultStates'
import { ActiveFilterChips, ResultsToolbar } from './ResultsToolbar'

function plural(count: number, one: string, many: string) {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`
}

export function ExplorerPage() {
  // All three collections, loaded once; the data is read-only for the session.
  const query = useQuery({
    queryKey: ['explorer', 'index'],
    queryFn: ({ signal }) => fetchExplorerIndex(signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false, // show the error with a Retry button instead of retrying silently
  })
  const index = query.data
  const { filters, update, replaceAll } = useExplorerUrlState()
  const commitQuery = useCallback((q: string) => update({ q }, { replace: true }), [update])
  const search = useSearchInput(filters.q, commitQuery)
  const deferredQuery = useDeferredValue(search.value)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null)
  const searchId = useId()
  const slow = useDelayedFlag(query.isPending)

  // Once data is loaded, drop URL selections that cannot apply (unknown ids, etc.).
  const canonical = useMemo(() => (index ? canonicalizeFilters(filters, index) : filters), [filters, index])
  useEffect(() => {
    if (index && !filtersEqual(canonical, filters)) replaceAll(canonical, { replace: true })
  }, [index, canonical, filters, replaceAll])

  const effective: ExplorerFilters = useMemo(() => ({ ...canonical, q: deferredQuery }), [canonical, deferredQuery])

  const evaluation = useMemo(() => {
    if (!index) return null
    performance.mark('explorer-evaluate-start')
    const result = evaluateExplorer(index.services, effective, index.subcategoryParents)
    performance.measure('explorer-evaluate', 'explorer-evaluate-start')
    return result
  }, [index, effective])

  const groups = useMemo(
    () => (evaluation ? groupAndSort(evaluation.results, effective.sort, effective.q) : []),
    [evaluation, effective.sort, effective.q],
  )
  const page = clampPage(canonical.page, groups.length)
  const totalPages = countPages(groups.length)
  const pageGroups = paginate(groups, page)
  // Dim stale results only when they lag noticeably; filtering usually
  // catches up within a frame, and dimming every keystroke flickers.
  const resultsStale = useDelayedFlag(search.value !== deferredQuery, 200)
  const activeFilters = index ? describeActiveFilters({ ...canonical, q: '' }, index) : []
  const showCurrencySections = (effective.sort === 'price_asc' || effective.sort === 'price_desc') && !effective.currency
  const filterCount = activeFilterCount(canonical)

  const goToPage = (next: number) => {
    update({ page: next })
    resultsHeadingRef.current?.scrollIntoView({ block: 'start' })
    resultsHeadingRef.current?.focus({ preventScroll: true })
  }

  const clearAll = () => {
    search.setValue('')
    replaceAll({ ...DEFAULT_FILTERS, sort: canonical.sort })
  }

  const resultCount = evaluation?.results.length ?? 0
  const summary = evaluation
    ? resultCount === 0
      ? 'No matching services'
      : `${plural(resultCount, 'service', 'services')} from ${plural(groups.length, 'provider', 'providers')}`
    : ''

  return (
    <>
      <title>Explore services · MedEx</title>
      <section className="border-b bg-surface">
        <PageContainer className="py-10 sm:py-14">
          <p className="text-sm font-semibold tracking-wide text-brand-magenta uppercase">Explore services</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Find and compare health services
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground sm:text-lg">
            Browse check-ups, lab tests and treatments from clinics, hospitals and labs.
          </p>
          <form
            role="search"
            className="mt-6 flex max-w-2xl flex-col gap-2 rounded-lg border bg-card p-2 shadow-card transition-shadow focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/20 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              search.commitNow()
            }}
          >
            <Label htmlFor={searchId} className="sr-only">
              Search services, providers or categories
            </Label>
            <div className="relative flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id={searchId}
                type="search"
                value={search.value}
                onChange={(e) => search.setValue(e.target.value)}
                placeholder="e.g. full body check-up"
                autoComplete="off"
                className="h-12 border-0 pl-10 text-base text-foreground shadow-none focus-visible:ring-0"
              />
            </div>
            <Button type="submit" size="lg" className="h-12 px-6">
              Search
            </Button>
          </form>
        </PageContainer>
      </section>

      <PageContainer className="py-6 sm:py-8">
        <OfflineBanner detail="Results already loaded still work; new data can't be fetched." />

        {query.isError ? (
          <ErrorState
            title="We couldn't load services"
            message={describeApiError(query.error)}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        ) : (
          <>
            {evaluation && (
              <div className="mb-6">
                <CategoryNav
                  selected={canonical.types}
                  counts={evaluation.counts.type}
                  onSelect={(types) => update({ types })}
                />
              </div>
            )}

            <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
              <aside
                aria-label="Filters"
                className="hidden rounded-lg border bg-card p-5 shadow-card lg:sticky lg:top-20 lg:block lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto"
              >
                {index && evaluation ? (
                  <>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="flex items-center gap-2 text-base font-semibold">
                        <SlidersHorizontal aria-hidden="true" className="size-4 text-primary" />
                        Filters
                      </h2>
                      {filterCount > 0 && (
                        <Button variant="link" size="sm" className="h-auto p-0" onClick={clearAll}>
                          Clear all
                        </Button>
                      )}
                    </div>
                    <FilterPanel index={index} filters={canonical} counts={evaluation.counts} onChange={update} />
                  </>
                ) : (
                  <div aria-hidden="true" className="h-96 animate-pulse rounded-lg bg-muted" />
                )}
              </aside>

              <section aria-labelledby="results-heading" className="min-w-0">
                <ResultsToolbar
                  headingRef={resultsHeadingRef}
                  summary={summary}
                  filterCount={filterCount}
                  canOpenFilters={Boolean(index)}
                  onOpenFilters={() => setDrawerOpen(true)}
                  sort={canonical.sort}
                  onSortChange={(sort) => update({ sort })}
                />
                <ActiveFilterChips filters={activeFilters} onRemove={update} />

                {showCurrencySections && groups.length > 0 && new Set(groups.map((g) => g.provider.currency)).size > 1 && (
                  <p className="mb-4 flex items-start gap-2 rounded-lg border-l-4 border-brand-teal bg-card px-4 py-3 text-sm text-muted-foreground">
                    <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-teal" />
                    Prices are compared within each currency only. Choose a currency under Price to compare everything on
                    one scale.
                  </p>
                )}

                {!index || !evaluation ? (
                  <ResultsSkeleton slow={slow} />
                ) : resultCount === 0 ? (
                  <EmptyResults index={index} filters={effective} onChange={update} onClearAll={clearAll} />
                ) : (
                  <div aria-busy={resultsStale} className={cn('transition-opacity', resultsStale && 'opacity-60')}>
                    <ol className="grid gap-4">
                      {pageGroups.map((group, i) => {
                        const previous = pageGroups[i - 1]
                        const newSection =
                          showCurrencySections && (!previous || previous.provider.currency !== group.provider.currency)
                        return (
                          <li key={group.provider.id}>
                            {newSection && (
                              <h3 className="mt-2 mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                                Prices in {group.provider.currency}
                              </h3>
                            )}
                            <ProviderCard group={group} />
                          </li>
                        )
                      })}
                    </ol>
                    <Pagination page={page} pageCount={totalPages} onChange={goToPage} />
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        {index && (
          <FilterDrawer
            open={drawerOpen}
            index={index}
            filters={canonical}
            onApply={(next) => {
              setDrawerOpen(false)
              replaceAll({ ...next, page: 1 })
            }}
            onClose={() => setDrawerOpen(false)}
          />
        )}

        {index && <DataNotes index={index} />}
      </PageContainer>
    </>
  )
}
