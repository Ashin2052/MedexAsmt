import { describe, expect, it } from 'vitest'
import { fixtureIndex } from '../../../test/explorerIndex'
import { DEFAULT_FILTERS, type ExplorerFilters } from '../types'
import { applyFilterChange, canonicalizeFilters, parseFilters, serializeFilters } from './urlState'

const index = fixtureIndex()
const ultrasound = index.categories.find((c) => c.title === 'Ultrasound' && c.type === 'package')!
const thyroid = ultrasound.children[0]

describe('URL state', () => {
  it('round-trips every filter, the sort and the page', () => {
    const filters: ExplorerFilters = {
      q: 'full body',
      types: ['package', 'lab_test'],
      categoryIds: [ultrasound.id],
      subCategoryIds: [thyroid.id],
      providerIds: [48, 102],
      location: { kind: 'city', slug: 'bangkok' },
      currency: 'THB',
      min: 100,
      max: 5000,
      homeTest: true,
      sort: 'price_asc',
      page: 3,
    }
    const params = serializeFilters(filters)
    expect(parseFilters(new URLSearchParams(params.toString()))).toEqual(filters)
  })

  it('omits defaults so the plain page has a clean URL', () => {
    expect(serializeFilters(DEFAULT_FILTERS).toString()).toBe('')
  })

  it('ignores malformed values instead of failing', () => {
    const filters = parseFilters(
      new URLSearchParams('type=bogus&type=wellness&provider=abc&provider=48&cur=USD&min=-5&max=lots&sort=newest&page=-2&home=yes'),
    )
    expect(filters).toEqual({ ...DEFAULT_FILTERS, types: ['wellness'], providerIds: [48] })
  })

  it('canonicalises unknown ids, orphaned subcategories and a range without currency', () => {
    const filters = canonicalizeFilters(
      {
        ...DEFAULT_FILTERS,
        categoryIds: ['no-such-category'],
        subCategoryIds: [thyroid.id], // parent not selected
        providerIds: [48, 999999],
        location: { kind: 'city', slug: 'atlantis' },
        min: 10,
        max: 20,
      },
      index,
    )
    expect(filters).toEqual({ ...DEFAULT_FILTERS, providerIds: [48] })
  })

  it('swaps a reversed price range', () => {
    const filters = canonicalizeFilters({ ...DEFAULT_FILTERS, currency: 'NPR', min: 900, max: 100 }, index)
    expect([filters.min, filters.max]).toEqual([100, 900])
  })

  it('returns to page 1 when a filter changes, but not when the page changes', () => {
    const onPage3 = { ...DEFAULT_FILTERS, page: 3 }
    expect(applyFilterChange(onPage3, { types: ['wellness'] }).page).toBe(1)
    expect(applyFilterChange(onPage3, { page: 4 }).page).toBe(4)
  })

  it('clears the range when the currency changes', () => {
    const thb = { ...DEFAULT_FILTERS, currency: 'THB' as const, max: 5000 }
    expect(applyFilterChange(thb, { currency: 'NPR' })).toMatchObject({ currency: 'NPR', min: null, max: null })
  })
})
