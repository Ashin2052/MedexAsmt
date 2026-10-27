// Provider grouping, sorting and pagination of matching services.
//
// Relevance (our definition):
//   with a search query  → strongest title match first (whole query at the
//                          start of the title > whole query inside the title >
//                          every word in the title > match only in category or
//                          provider name), then provider rating score;
//   without a query      → provider rating score (rating weighted by number
//                          of reviews), then number of matching services.
// Price sorts compare a provider's cheapest (low→high) or most expensive
// (high→low) matching price. Prices are only comparable within one currency,
// so price-sorted results are sectioned by currency.
import type { Currency } from '../../../shared/lib/money'
import { CURRENCIES } from '../../../shared/lib/money'
import type { ProviderView, ServiceView, SortKey } from '../types'
import { queryTokens } from './facets'
import { searchNormalize } from './normalize'

export const PROVIDERS_PER_PAGE = 10

export type ProviderGroup = {
  provider: ProviderView
  /** Matching services in display order (the card shows the first 3). */
  services: ServiceView[]
}

export function relevanceScore(service: ServiceView, query: string): number {
  const phrase = searchNormalize(query)
  if (!phrase) return 0
  if (service.titleText.startsWith(phrase)) return 4
  if (service.titleText.includes(phrase)) return 3
  const tokens = queryTokens(query)
  if (tokens.every((token) => service.titleText.includes(token))) return 2
  return 1
}

function lowestPrice(service: ServiceView): number | null {
  return service.priceCandidates.length ? Math.min(...service.priceCandidates) : null
}

function highestPrice(service: ServiceView): number | null {
  return service.priceCandidates.length ? Math.max(...service.priceCandidates) : null
}

/** Ascending numeric compare with nulls (unknown prices) always last. */
function compareNullableAsc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a - b
}

function compareNullableDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return b - a
}

/** Currencies in order of how many matching services use them (ties in fixed order). */
function currencyOrder(services: ServiceView[]): Currency[] {
  const counts = new Map<Currency, number>()
  for (const service of services) counts.set(service.provider.currency, (counts.get(service.provider.currency) ?? 0) + 1)
  return CURRENCIES.filter((c) => counts.has(c)).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
}

export function groupAndSort(results: ServiceView[], sort: SortKey, query: string): ProviderGroup[] {
  const byProvider = new Map<number, ServiceView[]>()
  for (const service of results) {
    const list = byProvider.get(service.provider.id)
    if (list) list.push(service)
    else byProvider.set(service.provider.id, [service])
  }

  const hasQuery = queryTokens(query).length > 0
  const scores = new Map<string, number>()
  if (sort === 'relevance' && hasQuery) {
    for (const service of results) scores.set(service.id, relevanceScore(service, query))
  }
  const score = (service: ServiceView) => scores.get(service.id) ?? 0
  const byTitle = (a: ServiceView, b: ServiceView) => a.title.localeCompare(b.title)

  const groups: ProviderGroup[] = [...byProvider.values()].map((services) => {
    const sorted = [...services]
    if (sort === 'price_asc') sorted.sort((a, b) => compareNullableAsc(lowestPrice(a), lowestPrice(b)) || byTitle(a, b))
    else if (sort === 'price_desc')
      sorted.sort((a, b) => compareNullableDesc(highestPrice(a), highestPrice(b)) || byTitle(a, b))
    else if (sort === 'relevance' && hasQuery) sorted.sort((a, b) => score(b) - score(a) || byTitle(a, b))
    else sorted.sort(byTitle)
    return { provider: services[0].provider, services: sorted }
  })

  const byName = (a: ProviderGroup, b: ProviderGroup) => a.provider.name.localeCompare(b.provider.name)
  const ratingScore = (g: ProviderGroup) => g.provider.ratingScore

  switch (sort) {
    case 'rating':
      groups.sort(
        (a, b) =>
          compareNullableDesc(a.provider.rating, b.provider.rating) ||
          b.provider.reviewCount - a.provider.reviewCount ||
          byName(a, b),
      )
      break
    case 'price_asc':
    case 'price_desc': {
      const order = currencyOrder(results)
      const pick = sort === 'price_asc' ? lowestPrice : highestPrice
      const compare = sort === 'price_asc' ? compareNullableAsc : compareNullableDesc
      groups.sort(
        (a, b) =>
          order.indexOf(a.provider.currency) - order.indexOf(b.provider.currency) ||
          compare(pick(a.services[0]), pick(b.services[0])) ||
          byName(a, b),
      )
      break
    }
    case 'relevance':
      groups.sort(
        (a, b) =>
          (hasQuery ? score(b.services[0]) - score(a.services[0]) : 0) ||
          compareNullableDesc(ratingScore(a), ratingScore(b)) ||
          b.services.length - a.services.length ||
          byName(a, b),
      )
      break
  }
  return groups
}

export function pageCount(groupCount: number): number {
  return Math.max(1, Math.ceil(groupCount / PROVIDERS_PER_PAGE))
}

export function clampPage(page: number, groupCount: number): number {
  return Math.min(Math.max(1, Math.floor(page)), pageCount(groupCount))
}

/** Page buttons to show: first, last, current ±1, with gaps marked. */
export function visiblePages(page: number, totalPages: number): (number | 'gap')[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages))
  const sorted = [...pages].sort((a, b) => a - b)
  const result: (number | 'gap')[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('gap')
    result.push(p)
  })
  return result
}

export function paginate(groups: ProviderGroup[], page: number): ProviderGroup[] {
  const start = (clampPage(page, groups.length) - 1) * PROVIDERS_PER_PAGE
  return groups.slice(start, start + PROVIDERS_PER_PAGE)
}
