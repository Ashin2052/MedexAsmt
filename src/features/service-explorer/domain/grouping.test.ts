import { describe, expect, it } from 'vitest'
import { fixtureIndex } from '../../../test/explorerIndex'
import { DEFAULT_FILTERS, type ExplorerFilters } from '../types'
import { evaluateExplorer } from './facets'
import { clampPage, groupAndSort, paginate, PROVIDERS_PER_PAGE, relevanceScore, visiblePages } from './grouping'

const index = fixtureIndex()
const results = (filters: Partial<ExplorerFilters> = {}) =>
  evaluateExplorer(index.services, { ...DEFAULT_FILTERS, ...filters }, index.subcategoryParents).results

const cheapest = (prices: number[]) => (prices.length ? Math.min(...prices) : Infinity)

describe('groupAndSort', () => {
  it('groups every matching service under its provider exactly once', () => {
    const matches = results({ location: { kind: 'country', code: 'TH' } })
    const groups = groupAndSort(matches, 'relevance', '')
    expect(groups.reduce((n, g) => n + g.services.length, 0)).toBe(matches.length)
    expect(new Set(groups.map((g) => g.provider.id)).size).toBe(groups.length)
    expect(groups.every((g) => g.services.every((s) => s.provider.id === g.provider.id))).toBe(true)
  })

  it('sorts by rating with unrated providers last', () => {
    const groups = groupAndSort(results(), 'rating', '')
    const ratings = groups.map((g) => g.provider.rating)
    const firstUnrated = ratings.indexOf(null)
    expect(firstUnrated).toBeGreaterThan(0)
    expect(ratings.slice(firstUnrated).every((r) => r === null)).toBe(true)
    const rated = ratings.slice(0, firstUnrated) as number[]
    expect(rated).toEqual([...rated].sort((a, b) => b - a))
  })

  it('price low→high keeps currencies apart and orders providers by cheapest service', () => {
    const groups = groupAndSort(results(), 'price_asc', '')
    // Currency sections are contiguous.
    const sequence = groups.map((g) => g.provider.currency).filter((c, i, all) => c !== all[i - 1])
    expect(new Set(sequence).size).toBe(sequence.length)
    for (const currency of new Set(sequence)) {
      const prices = groups.filter((g) => g.provider.currency === currency).map((g) => cheapest(g.services[0].priceCandidates))
      expect(prices).toEqual([...prices].sort((a, b) => a - b))
    }
    // Within a card, cheapest first; unknown prices last.
    for (const group of groups) {
      const own = group.services.map((s) => cheapest(s.priceCandidates))
      expect(own).toEqual([...own].sort((a, b) => a - b))
    }
  })

  it('price high→low orders by each provider’s most expensive service', () => {
    const groups = groupAndSort(results({ currency: 'NPR' }), 'price_desc', '')
    const top = groups.map((g) => Math.max(...g.services[0].priceCandidates))
    expect(top).toEqual([...top].sort((a, b) => b - a))
  })

  it('relevance with a query puts title matches before category/provider-only matches', () => {
    const query = 'thyroid'
    const groups = groupAndSort(results({ q: query }), 'relevance', query)
    const scores = groups.map((g) => relevanceScore(g.services[0], query))
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })
})

describe('relevanceScore', () => {
  const service = index.services.find((s) => s.title.startsWith('Executive Health Check'))!
  it('ranks a title prefix above a title substring above word matches', () => {
    expect(relevanceScore(service, 'executive health')).toBe(4)
    expect(relevanceScore(service, 'health check')).toBe(3)
    expect(relevanceScore(service, 'check executive')).toBe(2)
  })
})

describe('pagination', () => {
  it('clamps out-of-range pages', () => {
    expect(clampPage(0, 25)).toBe(1)
    expect(clampPage(99, 25)).toBe(3)
    expect(clampPage(2, 0)).toBe(1)
  })

  it('returns one page of providers', () => {
    const groups = groupAndSort(results(), 'relevance', '')
    expect(paginate(groups, 1)).toHaveLength(PROVIDERS_PER_PAGE)
    expect(paginate(groups, 2)[0]).toBe(groups[PROVIDERS_PER_PAGE])
  })

  it('shows first, last and neighbours with gaps', () => {
    expect(visiblePages(1, 1)).toEqual([1])
    expect(visiblePages(5, 9)).toEqual([1, 'gap', 4, 5, 6, 'gap', 9])
    expect(visiblePages(2, 4)).toEqual([1, 2, 3, 4])
  })
})
