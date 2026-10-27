// Human-readable list of the active filters, each with the change that
// removes it. Drives the filter chips and the empty-state "way out".
import { formatMoney } from '../../../shared/lib/money'
import { SERVICE_TYPE_LABELS, type ExplorerFilters, type ExplorerIndex } from '../types'

export type ActiveFilter = {
  key: string
  label: string
  remove: Partial<ExplorerFilters>
}

function priceRangeLabel(filters: ExplorerFilters): string {
  const currency = filters.currency
  if (!currency) return ''
  const { min, max } = filters
  if (min !== null && max !== null) {
    return `${formatMoney({ amount: min, currency })} – ${formatMoney({ amount: max, currency })}`
  }
  if (min !== null) return `From ${formatMoney({ amount: min, currency })}`
  if (max !== null) return `Up to ${formatMoney({ amount: max, currency })}`
  return `Prices in ${currency}`
}

export function describeActiveFilters(filters: ExplorerFilters, index: ExplorerIndex): ActiveFilter[] {
  const active: ActiveFilter[] = []

  if (filters.q.trim()) active.push({ key: 'q', label: `Search: “${filters.q.trim()}”`, remove: { q: '' } })

  for (const type of filters.types) {
    active.push({
      key: `type:${type}`,
      label: SERVICE_TYPE_LABELS[type],
      remove: { types: filters.types.filter((t) => t !== type) },
    })
  }

  for (const id of filters.categoryIds) {
    const category = index.categoryById.get(id)
    if (!category) continue
    const childIds = new Set(category.children.map((c) => c.id))
    active.push({
      key: `cat:${id}`,
      label: `${category.title} (${SERVICE_TYPE_LABELS[category.type]})`,
      remove: {
        categoryIds: filters.categoryIds.filter((c) => c !== id),
        subCategoryIds: filters.subCategoryIds.filter((s) => !childIds.has(s)),
      },
    })
  }

  for (const id of filters.subCategoryIds) {
    const sub = index.categoryById.get(id)
    const parent = sub?.parentId ? index.categoryById.get(sub.parentId) : undefined
    if (!sub) continue
    active.push({
      key: `sub:${id}`,
      label: parent ? `${parent.title} › ${sub.title}` : sub.title,
      remove: { subCategoryIds: filters.subCategoryIds.filter((s) => s !== id) },
    })
  }

  for (const id of filters.providerIds) {
    const provider = index.providers.find((p) => p.id === id)
    if (!provider) continue
    active.push({
      key: `provider:${id}`,
      label: provider.name,
      remove: { providerIds: filters.providerIds.filter((p) => p !== id) },
    })
  }

  const location = filters.location
  if (location) {
    let label = ''
    for (const country of index.countries) {
      if (location.kind === 'country' && country.code === location.code) label = country.name
      const city = country.cities.find((c) => location.kind === 'city' && c.slug === location.slug)
      if (city) label = `${city.name}, ${country.name}`
    }
    active.push({ key: 'location', label: label || 'Location', remove: { location: null } })
  }

  if (filters.currency) {
    active.push({ key: 'price', label: priceRangeLabel(filters), remove: { currency: null, min: null, max: null } })
  }

  if (filters.homeTest) active.push({ key: 'home', label: 'Home test available', remove: { homeTest: false } })

  return active
}
