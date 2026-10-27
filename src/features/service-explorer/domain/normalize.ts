// Turns the three raw collections into the explorer's view model: visibility
// applied once, prices computed once, provider data joined onto each service,
// and search text precomputed so filtering 3,200 records stays cheap.
import { isCurrency } from '../../../shared/lib/money'
import type { RawExplorerData } from '../api/schemas'
import {
  SERVICE_TYPES,
  type CategoryNode,
  type DataIssue,
  type ExplorerIndex,
  type ProviderView,
  type ServiceType,
  type ServiceView,
} from '../types'
import { buildPriceInfo, parseDecimal, priceCandidates } from './pricing'

/** Review count at which a provider's own rating outweighs the average. */
const RATING_PRIOR_WEIGHT = 100

export function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/** Lower-case, accent-free, punctuation-free text for matching. */
export function searchNormalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isServiceType(value: string): value is ServiceType {
  return (SERVICE_TYPES as readonly string[]).includes(value)
}

function buildProviders(raw: RawExplorerData, issues: DataIssue[]): Map<number, ProviderView> {
  const rated = raw.providers.filter((p) => typeof p.providerInformation.rating === 'number')
  const meanRating = rated.length
    ? rated.reduce((sum, p) => sum + (p.providerInformation.rating ?? 0), 0) / rated.length
    : 0

  const providers = new Map<number, ProviderView>()
  for (const provider of raw.providers) {
    if (provider.status !== 'active') continue
    const info = provider.providerInformation
    if (!isCurrency(info.currency)) {
      issues.push({
        recordId: `provider:${provider.id}`,
        issue: `Unknown currency "${info.currency}"`,
        decision: 'Provider and its services hidden: prices cannot be shown honestly',
      })
      continue
    }
    const reviewCount = Math.max(0, info.reviewCount ?? 0)
    const rating = typeof info.rating === 'number' && reviewCount > 0 ? info.rating : null
    const ratingScore =
      rating === null
        ? null
        : (reviewCount / (reviewCount + RATING_PRIOR_WEIGHT)) * rating +
          (RATING_PRIOR_WEIGHT / (reviewCount + RATING_PRIOR_WEIGHT)) * meanRating
    providers.set(provider.id, {
      id: provider.id,
      name: cleanText(provider.name),
      city: { slug: info.city.slug, name: cleanText(info.city.name) },
      country: { code: info.country.alphaCode, name: cleanText(info.country.name) },
      currency: info.currency,
      rating,
      reviewCount,
      ratingScore,
    })
  }
  return providers
}

function buildCategories(raw: RawExplorerData) {
  const categories: CategoryNode[] = []
  const byId = new Map<string, CategoryNode>()
  const inactiveIds = new Set<string>()

  const sorted = [...raw.categories].sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
  for (const category of sorted) {
    if (!isServiceType(category.type)) continue
    if (!category.status) {
      inactiveIds.add(category.id)
      continue
    }
    const node: CategoryNode = {
      id: category.id,
      title: cleanText(category.title),
      type: category.type,
      parentId: null,
      children: [],
    }
    const children = [...category.children].sort((a, b) => a.position - b.position)
    for (const child of children) {
      if (!child.status) {
        inactiveIds.add(child.id)
        continue
      }
      const childNode: CategoryNode = {
        id: child.id,
        title: cleanText(child.title),
        type: category.type,
        parentId: category.id,
        children: [],
      }
      node.children.push(childNode)
      byId.set(child.id, childNode)
    }
    categories.push(node)
    byId.set(node.id, node)
  }
  return { categories, byId, inactiveIds }
}

export function buildExplorerIndex(raw: RawExplorerData, parseIssues: DataIssue[] = []): ExplorerIndex {
  const issues: DataIssue[] = [...parseIssues]
  const providers = buildProviders(raw, issues)
  const { categories, byId, inactiveIds } = buildCategories(raw)
  const inactiveProviderIds = new Set(raw.providers.filter((p) => p.status !== 'active').map((p) => p.id))
  const hidden = { inactiveService: 0, inactiveProvider: 0, inactiveCategory: 0, unknownReference: 0 }

  const services: ServiceView[] = []
  for (const service of raw.services) {
    if (service.status !== true) {
      hidden.inactiveService += 1
      continue
    }
    if (inactiveProviderIds.has(service.userId)) {
      hidden.inactiveProvider += 1
      continue
    }
    if (
      (service.categoryId && inactiveIds.has(service.categoryId)) ||
      (service.subCategoryId && inactiveIds.has(service.subCategoryId))
    ) {
      hidden.inactiveCategory += 1
      continue
    }
    const provider = providers.get(service.userId)
    const category = service.categoryId ? byId.get(service.categoryId) : undefined
    const subCategory = service.subCategoryId ? byId.get(service.subCategoryId) : undefined
    if (
      !provider ||
      !isServiceType(service.type) ||
      (service.categoryId && !category) ||
      (service.subCategoryId && !subCategory)
    ) {
      hidden.unknownReference += 1
      issues.push({
        recordId: `service:${service.id}`,
        issue: 'Refers to a provider, type or category that does not exist',
        decision: 'Hidden: visibility cannot be confirmed',
      })
      continue
    }

    const title = cleanText(service.title)
    if (title !== service.title) {
      issues.push({
        recordId: `service:${service.id}`,
        issue: `Stray whitespace in title "${service.title}"`,
        decision: 'Whitespace trimmed and collapsed for display and search; casing kept as entered',
      })
    }

    const price = buildPriceInfo(service, provider.currency)
    if (price.kind === 'invalid') {
      issues.push({
        recordId: `service:${service.id}`,
        issue:
          price.reason === 'negative-final'
            ? `Discount exceeds price (price ${service.price}, discount ${service.discount})`
            : 'Price fields cannot be parsed',
        decision: 'Shown as "Price unavailable"; excluded from price filtering and sorted last by price',
      })
    }

    const homeCharge = service.testAtHome ? parseDecimal(service.homeTestCharge) : null
    services.push({
      id: service.id,
      title,
      type: service.type,
      provider,
      categoryId: category?.id ?? null,
      subCategoryId: subCategory?.id ?? null,
      categoryTitle: category?.title ?? null,
      subCategoryTitle: subCategory?.title ?? null,
      testAtHome: service.testAtHome,
      homeTestCharge: homeCharge === null ? null : { amount: homeCharge, currency: provider.currency },
      price,
      priceCandidates: priceCandidates(price),
      searchText: searchNormalize([title, provider.name, category?.title, subCategory?.title].join(' ')),
      titleText: searchNormalize(title),
    })
  }

  const visibleProviderIds = new Set(services.map((s) => s.provider.id))
  const providerList = [...providers.values()]
    .filter((p) => visibleProviderIds.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  const countries = new Map<string, { code: string; name: string; cities: Map<string, string> }>()
  for (const provider of providerList) {
    const country = countries.get(provider.country.code) ?? {
      code: provider.country.code,
      name: provider.country.name,
      cities: new Map<string, string>(),
    }
    country.cities.set(provider.city.slug, provider.city.name)
    countries.set(provider.country.code, country)
  }

  return {
    services,
    providers: providerList,
    categories,
    categoryById: byId,
    subcategoryParents: new Map(
      [...byId.values()].flatMap((node) => (node.parentId ? [[node.id, node.parentId] as const] : [])),
    ),
    countries: [...countries.values()]
      .map((c) => ({
        code: c.code,
        name: c.name,
        cities: [...c.cities].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    issues,
    hidden,
  }
}
