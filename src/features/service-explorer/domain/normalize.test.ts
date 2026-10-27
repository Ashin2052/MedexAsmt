import { describe, expect, it } from 'vitest'
import { fixtureIndex } from '../../../test/explorerIndex'
import { buildExplorerIndex, cleanText, searchNormalize } from './normalize'

describe('visibility on the real fixture', () => {
  const index = fixtureIndex()

  it('keeps only services that are active, from active providers, in active categories', () => {
    // 3,200 total − 198 inactive − 113 inactive provider − 36 inactive category (net of overlaps) = 2,853
    expect(index.services).toHaveLength(2853)
    expect(index.hidden).toEqual({
      inactiveService: 198,
      inactiveProvider: index.hidden.inactiveProvider,
      inactiveCategory: index.hidden.inactiveCategory,
      unknownReference: 0,
    })
    expect(index.services.every((s) => s.provider.id !== 161 && s.provider.id !== 162)).toBe(true)
  })

  it('never shows the inactive "Seasonal offers" category or its services', () => {
    expect(index.categories.some((c) => c.title.toLowerCase().includes('seasonal'))).toBe(false)
    expect(index.services.some((s) => s.categoryTitle?.toLowerCase().includes('seasonal'))).toBe(false)
  })

  it('keeps services that have no category (22 in the data, minus inactive ones)', () => {
    expect(index.services.filter((s) => s.categoryId === null).length).toBeGreaterThan(0)
  })

  it('treats the two "ultrasound" categories as different, identified by id', () => {
    const ultrasound = index.categories.filter((c) => c.title === 'Ultrasound')
    expect(ultrasound).toHaveLength(2)
    expect(new Set(ultrasound.map((c) => c.id)).size).toBe(2)
    expect(ultrasound.map((c) => c.type).sort()).toEqual(['lab_test', 'package'])
  })

  it('treats the three "Thyroid" subcategories as different, identified by id', () => {
    const thyroid = [...index.categoryById.values()].filter((c) => c.title === 'Thyroid')
    expect(thyroid).toHaveLength(3)
    expect(new Set(thyroid.map((c) => c.parentId)).size).toBe(3)
  })

  it('gives unrated providers no rating instead of zero stars', () => {
    const unrated = index.providers.filter((p) => p.rating === null)
    expect(unrated.length).toBeGreaterThan(0)
    expect(unrated.every((p) => p.ratingScore === null && p.reviewCount === 0)).toBe(true)
  })

  it('attaches the provider currency to every price', () => {
    for (const service of index.services) {
      const price = service.price
      const currency =
        price.kind === 'fixed' ? price.final.currency : price.kind === 'from' ? price.lowest.final.currency : price.currency
      expect(currency).toBe(service.provider.currency)
    }
  })

  it('records the data mistakes it handled', () => {
    const vitaminD = index.services.find((s) => s.title === 'Vitamin D Test' && s.provider.id === 48)
    expect(vitaminD?.price).toEqual({ kind: 'invalid', currency: 'THB', reason: 'negative-final' })
    expect(index.issues.some((i) => i.issue.startsWith('Discount exceeds price'))).toBe(true)
    expect(index.services.some((s) => s.title === 'hba1c TEST (Diabetes)')).toBe(true)
  })
})

describe('text helpers', () => {
  it('collapses stray whitespace but keeps casing', () => {
    expect(cleanText('  hba1c   TEST (Diabetes) ')).toBe('hba1c TEST (Diabetes)')
  })

  it('normalises text for search', () => {
    expect(searchNormalize('Full-Body  Check-Up!')).toBe('full body check up')
  })
})

describe('buildExplorerIndex with hand-made records', () => {
  const provider = (id: number, status = 'active') => ({
    id,
    name: `Provider ${id}`,
    status,
    providerInformation: {
      currency: 'THB',
      city: { name: 'Bangkok', slug: 'bangkok' },
      country: { name: 'Thailand', alphaCode: 'TH' },
      rating: 4.5,
      reviewCount: 10,
    },
  })
  const service = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    title: id,
    type: 'lab_test',
    userId: 1,
    categoryId: null,
    subCategoryId: null,
    price: '100.00',
    discount: '0.00',
    discountType: 'amount',
    serviceCharge: '0.00',
    serviceChargeType: 'amount',
    status: true,
    testAtHome: false,
    homeTestCharge: null,
    wellnessPricing: [],
    ...overrides,
  })

  it('hides services that point to a missing category and reports them', () => {
    const index = buildExplorerIndex({
      categories: [],
      providers: [provider(1)],
      services: [service('a'), service('b', { categoryId: 'missing' })],
    })
    expect(index.services.map((s) => s.id)).toEqual(['a'])
    expect(index.hidden.unknownReference).toBe(1)
  })

  it('hides providers with an unknown currency rather than guessing', () => {
    const odd = { ...provider(2), providerInformation: { ...provider(2).providerInformation, currency: 'USD' } }
    const index = buildExplorerIndex({ categories: [], providers: [odd], services: [service('a', { userId: 2 })] })
    expect(index.services).toHaveLength(0)
  })
})
