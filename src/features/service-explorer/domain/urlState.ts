// The URL is the source of truth for every filter, the sort and the page.
//
//   q        free-text search            type      service type (repeatable)
//   cat      category id (repeatable)    sub       subcategory id (repeatable)
//   provider provider id (repeatable)    city|country  one location
//   cur      price currency              min, max  price range in `cur`
//   home=1   available as a home test    sort      relevance | price_asc | price_desc | rating
//   page     1-based page of providers
//
// parse() never throws: unknown or malformed values are dropped. Once data is
// loaded, canonicalize() also drops ids that do not exist, so a shared or
// hand-edited link always resolves to a valid view.
import { isCurrency } from '../../../shared/lib/money'
import {
  DEFAULT_FILTERS,
  SERVICE_TYPES,
  SORT_KEYS,
  type ExplorerFilters,
  type ExplorerIndex,
  type ServiceType,
  type SortKey,
} from '../types'

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function parseAmount(value: string | null): number | null {
  if (value === null || value.trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

export function parseFilters(params: URLSearchParams): ExplorerFilters {
  const types = unique(params.getAll('type')).filter((t): t is ServiceType =>
    (SERVICE_TYPES as readonly string[]).includes(t),
  )
  const providerIds = unique(params.getAll('provider'))
    .filter((id) => /^\d+$/.test(id))
    .map(Number)
  const city = params.get('city')
  const country = params.get('country')
  const currency = params.get('cur')
  const sort = params.get('sort')
  const page = Number(params.get('page'))

  return {
    q: (params.get('q') ?? '').slice(0, 200),
    types,
    categoryIds: unique(params.getAll('cat')).filter(Boolean),
    subCategoryIds: unique(params.getAll('sub')).filter(Boolean),
    providerIds,
    location: city ? { kind: 'city', slug: city } : country ? { kind: 'country', code: country } : null,
    currency: isCurrency(currency) ? currency : null,
    min: parseAmount(params.get('min')),
    max: parseAmount(params.get('max')),
    homeTest: params.get('home') === '1',
    sort: (SORT_KEYS as readonly string[]).includes(sort ?? '') ? (sort as SortKey) : DEFAULT_FILTERS.sort,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

export function serializeFilters(filters: ExplorerFilters): URLSearchParams {
  const params = new URLSearchParams()
  const q = filters.q.trim()
  if (q) params.set('q', q)
  filters.types.forEach((t) => params.append('type', t))
  filters.categoryIds.forEach((id) => params.append('cat', id))
  filters.subCategoryIds.forEach((id) => params.append('sub', id))
  filters.providerIds.forEach((id) => params.append('provider', String(id)))
  if (filters.location?.kind === 'city') params.set('city', filters.location.slug)
  if (filters.location?.kind === 'country') params.set('country', filters.location.code)
  if (filters.currency) {
    params.set('cur', filters.currency)
    if (filters.min !== null) params.set('min', String(filters.min))
    if (filters.max !== null) params.set('max', String(filters.max))
  }
  if (filters.homeTest) params.set('home', '1')
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort)
  if (filters.page > 1) params.set('page', String(filters.page))
  return params
}

/**
 * Remove selections that cannot apply: unknown ids, subcategories whose parent
 * category is not selected, a price range without a currency, min > max.
 */
export function canonicalizeFilters(filters: ExplorerFilters, index: ExplorerIndex): ExplorerFilters {
  const categoryIds = filters.categoryIds.filter((id) => index.categoryById.get(id)?.parentId === null)
  const selected = new Set(categoryIds)
  const subCategoryIds = filters.subCategoryIds.filter((id) => {
    const parent = index.subcategoryParents.get(id)
    return parent !== undefined && selected.has(parent)
  })
  const providerIds = filters.providerIds.filter((id) => index.providers.some((p) => p.id === id))

  let location = filters.location
  if (location?.kind === 'city') {
    const slug = location.slug
    if (!index.countries.some((c) => c.cities.some((city) => city.slug === slug))) location = null
  } else if (location?.kind === 'country') {
    const code = location.code
    if (!index.countries.some((c) => c.code === code)) location = null
  }

  let { min, max } = filters
  if (!filters.currency) {
    min = null
    max = null
  } else if (min !== null && max !== null && min > max) {
    ;[min, max] = [max, min]
  }

  return { ...filters, categoryIds, subCategoryIds, providerIds, location, min, max }
}

export function filtersEqual(a: ExplorerFilters, b: ExplorerFilters): boolean {
  return serializeFilters(a).toString() === serializeFilters(b).toString()
}

/** Apply a change; any change other than the page itself returns to page 1. */
export function applyFilterChange(filters: ExplorerFilters, patch: Partial<ExplorerFilters>): ExplorerFilters {
  const next = { ...filters, ...patch }
  if (!('page' in patch)) next.page = 1
  // A range only means something in the currency it was entered in.
  if ('currency' in patch && patch.currency !== filters.currency && !('min' in patch) && !('max' in patch)) {
    next.min = null
    next.max = null
  }
  return next
}

/** Number of active filter selections (for the mobile "Filters (n)" button). */
export function activeFilterCount(filters: ExplorerFilters): number {
  return (
    filters.types.length +
    filters.categoryIds.length +
    filters.subCategoryIds.length +
    filters.providerIds.length +
    (filters.location ? 1 : 0) +
    (filters.currency ? 1 : 0) +
    (filters.homeTest ? 1 : 0)
  )
}
