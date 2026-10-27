import { describe, expect, it } from 'vitest'
import { CURRENCIES } from '../../../shared/lib/money'
import { fixtureIndex } from '../../../test/explorerIndex'
import { DEFAULT_FILTERS, SERVICE_TYPES, type ExplorerFilters, type ServiceView } from '../types'
import { countResults, evaluateExplorer, queryTokens, type FacetKey } from './facets'

const index = fixtureIndex()
const evaluate = (filters: Partial<ExplorerFilters>) =>
  evaluateExplorer(index.services, { ...DEFAULT_FILTERS, ...filters }, index.subcategoryParents)

const ultrasoundPackage = index.categories.find((c) => c.title === 'Ultrasound' && c.type === 'package')!
const ultrasoundLab = index.categories.find((c) => c.title === 'Ultrasound' && c.type === 'lab_test')!

// ---- Independent reference implementation (deliberately naive) ----
function referencePasses(s: ServiceView, f: ExplorerFilters, skip: FacetKey | null): boolean {
  const tokens = queryTokens(f.q)
  if (!tokens.every((t) => s.searchText.includes(t))) return false
  if (skip !== 'type' && f.types.length && !f.types.includes(s.type)) return false
  if (skip !== 'category' && f.categoryIds.length) {
    if (!s.categoryId || !f.categoryIds.includes(s.categoryId)) return false
    const subsOfParent = f.subCategoryIds.filter((id) => index.subcategoryParents.get(id) === s.categoryId)
    if (subsOfParent.length && !subsOfParent.includes(s.subCategoryId ?? '')) return false
  }
  if (skip !== 'provider' && f.providerIds.length && !f.providerIds.includes(s.provider.id)) return false
  if (skip !== 'location' && f.location) {
    if (f.location.kind === 'city' && s.provider.city.slug !== f.location.slug) return false
    if (f.location.kind === 'country' && s.provider.country.code !== f.location.code) return false
  }
  if (skip !== 'price' && f.currency) {
    if (s.provider.currency !== f.currency) return false
    if (f.min !== null || f.max !== null) {
      const ok = s.priceCandidates.some((p) => (f.min === null || p >= f.min) && (f.max === null || p <= f.max))
      if (!ok) return false
    }
  }
  if (skip !== 'home' && f.homeTest && !s.testAtHome) return false
  return true
}

function referenceCount(f: ExplorerFilters, skip: FacetKey | null, has: (s: ServiceView) => boolean) {
  return index.services.filter((s) => referencePasses(s, f, skip) && has(s)).length
}

function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32
    return state / 2 ** 32
  }
}

function randomFilters(random: () => number): ExplorerFilters {
  const pick = <T,>(list: readonly T[], chance: number) => list.filter(() => random() < chance)
  const categoryIds = pick(index.categories.map((c) => c.id), 0.15)
  const subCategoryIds = index.categories
    .filter((c) => categoryIds.includes(c.id))
    .flatMap((c) => pick(c.children.map((child) => child.id), 0.4))
  const currency = random() < 0.4 ? CURRENCIES[Math.floor(random() * 3)] : null
  const cities = index.countries.flatMap((c) => c.cities)
  const locationRoll = random()
  return {
    ...DEFAULT_FILTERS,
    q: random() < 0.2 ? ['check', 'blood', 'massage', 'test'][Math.floor(random() * 4)] : '',
    types: pick(SERVICE_TYPES, 0.25),
    categoryIds,
    subCategoryIds,
    providerIds: pick(index.providers.map((p) => p.id), 0.05),
    location:
      locationRoll < 0.2
        ? { kind: 'city', slug: cities[Math.floor(random() * cities.length)].slug }
        : locationRoll < 0.3
          ? { kind: 'country', code: index.countries[Math.floor(random() * index.countries.length)].code }
          : null,
    currency,
    min: currency && random() < 0.5 ? Math.floor(random() * 3000) : null,
    max: currency && random() < 0.5 ? 3000 + Math.floor(random() * 20000) : null,
    homeTest: random() < 0.2,
  }
}

describe('evaluateExplorer', () => {
  it('returns every visible service when nothing is selected', () => {
    const { results, counts } = evaluate({})
    expect(results).toHaveLength(index.services.length)
    expect([...counts.type.values()].reduce((a, b) => a + b, 0)).toBe(index.services.length)
  })

  it('counts each option given the other filters (brief example: Bangkok + lab test)', () => {
    const bangkokOnly = evaluate({ location: { kind: 'city', slug: 'bangkok' } })
    const bangkokLabTests = index.services.filter(
      (s) => s.provider.city.slug === 'bangkok' && s.type === 'lab_test',
    ).length
    expect(bangkokOnly.counts.type.get('lab_test')).toBe(bangkokLabTests)

    // Selecting a type must not change the counts of the type facet itself.
    const withType = evaluate({ location: { kind: 'city', slug: 'bangkok' }, types: ['lab_test'] })
    expect(withType.counts.type).toEqual(bangkokOnly.counts.type)
    expect(withType.results).toHaveLength(bangkokLabTests)
  })

  it('keeps the two "ultrasound" categories separate', () => {
    const pkg = evaluate({ categoryIds: [ultrasoundPackage.id] }).results
    const lab = evaluate({ categoryIds: [ultrasoundLab.id] }).results
    expect(pkg.length).toBeGreaterThan(0)
    expect(lab.length).toBeGreaterThan(0)
    expect(pkg.every((s) => s.type === 'package')).toBe(true)
    expect(lab.every((s) => s.type === 'lab_test')).toBe(true)
  })

  it('narrows a category by its subcategory without affecting other selected categories', () => {
    const thyroid = ultrasoundPackage.children.find((c) => c.title === 'Thyroid')!
    const result = evaluate({
      categoryIds: [ultrasoundPackage.id, ultrasoundLab.id],
      subCategoryIds: [thyroid.id],
    }).results
    const fromPackage = result.filter((s) => s.categoryId === ultrasoundPackage.id)
    expect(fromPackage.every((s) => s.subCategoryId === thyroid.id)).toBe(true)
    expect(result.filter((s) => s.categoryId === ultrasoundLab.id)).toHaveLength(
      evaluate({ categoryIds: [ultrasoundLab.id] }).results.length,
    )
  })

  it('never mixes currencies in a price range', () => {
    const { results } = evaluate({ currency: 'THB', max: 5000 })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((s) => s.provider.currency === 'THB')).toBe(true)
    expect(results.every((s) => s.priceCandidates.some((p) => p <= 5000))).toBe(true)
  })

  it('excludes services with an unknown price from a price range but not from a currency-only filter', () => {
    const vitaminD = index.services.find((s) => s.price.kind === 'invalid')!
    expect(evaluate({ currency: 'THB' }).results).toContain(vitaminD)
    expect(evaluate({ currency: 'THB', min: 0 }).results).not.toContain(vitaminD)
  })

  it('matches a wellness service when any of its durations is in range', () => {
    const { results } = evaluate({ types: ['wellness'], currency: 'THB', min: 0, max: 1000 })
    expect(results.every((s) => s.priceCandidates.some((p) => p <= 1000))).toBe(true)
  })

  it('searches title, provider name and category, requiring every word', () => {
    const provider = index.providers[0]
    const byProvider = evaluate({ q: provider.name }).results
    expect(byProvider.length).toBeGreaterThan(0)
    expect(byProvider.some((s) => s.provider.id === provider.id)).toBe(true)
    expect(evaluate({ q: 'ultrasound thyroid' }).results.every((s) => s.searchText.includes('thyroid'))).toBe(true)
    expect(evaluate({ q: 'zzzz-no-such-service' }).results).toHaveLength(0)
  })

  // The naive reference re-scans every service per option: slow by design, so a longer timeout.
  it('matches the brute-force reference for 300 random filter combinations', { timeout: 30_000 }, () => {
    const random = seededRandom(20261027)
    for (let run = 0; run < 300; run += 1) {
      const filters = randomFilters(random)
      const { results, counts } = evaluateExplorer(index.services, filters, index.subcategoryParents)
      const label = JSON.stringify(filters)

      expect(results.length, label).toBe(referenceCount(filters, null, () => true))
      for (const type of SERVICE_TYPES) {
        expect(counts.type.get(type) ?? 0, `${label} type=${type}`).toBe(referenceCount(filters, 'type', (s) => s.type === type))
      }
      for (const category of index.categories) {
        expect(counts.category.get(category.id) ?? 0, `${label} cat`).toBe(
          referenceCount(filters, 'category', (s) => s.categoryId === category.id),
        )
      }
      for (const provider of index.providers.slice(0, 10)) {
        expect(counts.provider.get(provider.id) ?? 0, `${label} provider`).toBe(
          referenceCount(filters, 'provider', (s) => s.provider.id === provider.id),
        )
      }
      for (const country of index.countries) {
        expect(counts.country.get(country.code) ?? 0, `${label} country`).toBe(
          referenceCount(filters, 'location', (s) => s.provider.country.code === country.code),
        )
      }
      for (const currency of CURRENCIES) {
        expect(counts.currency.get(currency) ?? 0, `${label} currency`).toBe(
          referenceCount(filters, 'price', (s) => s.provider.currency === currency),
        )
      }
      expect(counts.home, `${label} home`).toBe(referenceCount(filters, 'home', (s) => s.testAtHome))
    }
  })

  it('countResults agrees with evaluateExplorer', () => {
    const filters = { ...DEFAULT_FILTERS, types: ['lab_test' as const], homeTest: true }
    expect(countResults(index.services, filters, index.subcategoryParents)).toBe(evaluate(filters).results.length)
  })
})

describe('performance on all 3,200 services (2,853 visible)', () => {
  it('evaluates a filter change well within the 100 ms budget', () => {
    const scenarios: Partial<ExplorerFilters>[] = [
      {},
      { location: { kind: 'city', slug: 'bangkok' } },
      { location: { kind: 'city', slug: 'bangkok' }, types: ['package'], currency: 'THB', max: 5000 },
      { q: 'check up', homeTest: true, types: ['lab_test', 'package'] },
    ]
    const timings: number[] = []
    for (let i = 0; i < 20; i += 1) {
      for (const scenario of scenarios) {
        const start = performance.now()
        evaluate(scenario)
        timings.push(performance.now() - start)
      }
    }
    timings.sort((a, b) => a - b)
    const median = timings[Math.floor(timings.length / 2)]
    const p95 = timings[Math.floor(timings.length * 0.95)]
    console.info(`[perf] evaluateExplorer median ${median.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms (${timings.length} runs)`)
    // Generous bound so the test is stable on slow CI; real numbers are logged above.
    expect(p95).toBeLessThan(50)
  })
})
