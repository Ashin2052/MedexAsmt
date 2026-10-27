// Filtering and live facet counts in one pass over the visible services.
//
// Facet rule (brief): each option shows how many results it would lead to
// given all the OTHER active filters. For every service we count how many
// active facets reject it:
//   0 rejections → it is a result, and counts towards every facet's options;
//   1 rejection  → it is not a result, but counts towards the options of the
//                  one facet that rejected it (that facet's own selection is
//                  ignored when counting its options);
//   2+           → it counts nowhere.
// Free-text search is not a facet: it applies to results and to all counts.
import type { Currency } from '../../../shared/lib/money'
import type { ExplorerFilters, ServiceType, ServiceView } from '../types'
import { searchNormalize } from './normalize'

const FACET_KEYS = ['type', 'category', 'provider', 'location', 'price', 'home'] as const
export type FacetKey = (typeof FACET_KEYS)[number]

export type FacetCounts = {
  type: Map<ServiceType, number>
  /** Keyed by category id and subcategory id. */
  category: Map<string, number>
  provider: Map<number, number>
  city: Map<string, number>
  country: Map<string, number>
  currency: Map<Currency, number>
  home: number
}

type ExplorerEvaluation = {
  results: ServiceView[]
  counts: FacetCounts
}

type Predicate = (service: ServiceView) => boolean

/** Split a query into normalised tokens; every token must appear in the search text. */
export function queryTokens(query: string): string[] {
  const normalised = searchNormalize(query)
  return normalised ? normalised.split(' ') : []
}

function matchesQuery(service: ServiceView, tokens: string[]): boolean {
  return tokens.every((token) => service.searchText.includes(token))
}

function inRange(candidates: number[], min: number | null, max: number | null): boolean {
  return candidates.some((amount) => (min === null || amount >= min) && (max === null || amount <= max))
}

/**
 * Predicates for the facets that currently have a selection.
 * `subcategoryParents` maps subcategory id → its category id.
 */
function activePredicates(
  filters: ExplorerFilters,
  subcategoryParents: Map<string, string>,
): Map<FacetKey, Predicate> {
  const predicates = new Map<FacetKey, Predicate>()

  if (filters.types.length) {
    const types = new Set(filters.types)
    predicates.set('type', (s) => types.has(s.type))
  }

  if (filters.categoryIds.length) {
    const categories = new Set(filters.categoryIds)
    const subcategories = new Set(filters.subCategoryIds)
    // A selected subcategory narrows only its own parent category.
    const narrowedParents = new Set(
      filters.subCategoryIds.map((id) => subcategoryParents.get(id)).filter((id) => id !== undefined),
    )
    predicates.set('category', (s) => {
      if (!s.categoryId || !categories.has(s.categoryId)) return false
      if (!narrowedParents.has(s.categoryId)) return true
      return s.subCategoryId !== null && subcategories.has(s.subCategoryId)
    })
  }

  if (filters.providerIds.length) {
    const providers = new Set(filters.providerIds)
    predicates.set('provider', (s) => providers.has(s.provider.id))
  }

  const location = filters.location
  if (location) {
    predicates.set('location', (s) =>
      location.kind === 'city' ? s.provider.city.slug === location.slug : s.provider.country.code === location.code,
    )
  }

  if (filters.currency) {
    const { currency, min, max } = filters
    const hasRange = min !== null || max !== null
    predicates.set(
      'price',
      (s) => s.provider.currency === currency && (!hasRange || inRange(s.priceCandidates, min, max)),
    )
  }

  if (filters.homeTest) {
    predicates.set('home', (s) => s.testAtHome)
  }

  return predicates
}

function emptyCounts(): FacetCounts {
  return {
    type: new Map(),
    category: new Map(),
    provider: new Map(),
    city: new Map(),
    country: new Map(),
    currency: new Map(),
    home: 0,
  }
}

function bump<K>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function tally(counts: FacetCounts, facet: FacetKey, s: ServiceView) {
  switch (facet) {
    case 'type':
      bump(counts.type, s.type)
      break
    case 'category':
      if (s.categoryId) bump(counts.category, s.categoryId)
      if (s.subCategoryId) bump(counts.category, s.subCategoryId)
      break
    case 'provider':
      bump(counts.provider, s.provider.id)
      break
    case 'location':
      bump(counts.city, s.provider.city.slug)
      bump(counts.country, s.provider.country.code)
      break
    case 'price':
      bump(counts.currency, s.provider.currency)
      break
    case 'home':
      if (s.testAtHome) counts.home += 1
      break
  }
}

export function evaluateExplorer(
  services: ServiceView[],
  filters: ExplorerFilters,
  subcategoryParents: Map<string, string>,
): ExplorerEvaluation {
  const tokens = queryTokens(filters.q)
  const predicates = [...activePredicates(filters, subcategoryParents)]
  const counts = emptyCounts()
  const results: ServiceView[] = []

  for (const service of services) {
    if (tokens.length && !matchesQuery(service, tokens)) continue

    let rejectedBy: FacetKey | null = null
    let rejections = 0
    for (const [facet, predicate] of predicates) {
      if (!predicate(service)) {
        rejections += 1
        rejectedBy = facet
        if (rejections > 1) break
      }
    }

    if (rejections === 0) {
      results.push(service)
      for (const facet of FACET_KEYS) tally(counts, facet, service)
    } else if (rejections === 1 && rejectedBy) {
      tally(counts, rejectedBy, service)
    }
  }

  return { results, counts }
}

/** Number of results if only `filters` were applied (used for "remove X" suggestions). */
export function countResults(
  services: ServiceView[],
  filters: ExplorerFilters,
  subcategoryParents: Map<string, string>,
): number {
  const tokens = queryTokens(filters.q)
  const predicates = [...activePredicates(filters, subcategoryParents).values()]
  let total = 0
  for (const service of services) {
    if (tokens.length && !matchesQuery(service, tokens)) continue
    if (predicates.every((predicate) => predicate(service))) total += 1
  }
  return total
}
