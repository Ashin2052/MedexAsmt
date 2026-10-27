import type { Currency, Money } from '../../shared/lib/money'

export const SERVICE_TYPES = ['package', 'lab_test', 'wellness', 'service', 'insurance'] as const
export type ServiceType = (typeof SERVICE_TYPES)[number]

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  package: 'Health package',
  lab_test: 'Lab test',
  wellness: 'Wellness',
  service: 'Service',
  insurance: 'Insurance',
}

export type WellnessOptionPrice = { durationInMinutes: number; final: Money }

export type PriceInfo =
  /** Ordinary priced service. `original` is set only when a discount applies. */
  | { kind: 'fixed'; final: Money; original: Money | null }
  | { kind: 'free'; currency: Currency }
  /** Wellness: no single price; the lowest valid option is shown, labelled. */
  | { kind: 'from'; lowest: WellnessOptionPrice; options: WellnessOptionPrice[] }
  /** Data error (e.g. discount larger than the price): shown as unavailable. */
  | { kind: 'invalid'; currency: Currency; reason: 'negative-final' | 'unparseable' | 'no-valid-options' }

export type ProviderView = {
  id: number
  name: string
  city: { slug: string; name: string }
  country: { code: string; name: string }
  currency: Currency
  rating: number | null
  reviewCount: number
  /** Bayesian-weighted rating used for ordering (null when unrated). */
  ratingScore: number | null
}

export type CategoryNode = {
  id: string
  title: string
  type: ServiceType
  parentId: string | null
  children: CategoryNode[]
}

export type ServiceView = {
  id: string
  title: string
  type: ServiceType
  provider: ProviderView
  categoryId: string | null
  subCategoryId: string | null
  categoryTitle: string | null
  subCategoryTitle: string | null
  testAtHome: boolean
  homeTestCharge: Money | null
  price: PriceInfo
  /** Every final amount a customer could pay (one per wellness option); used by the price filter. */
  priceCandidates: number[]
  /** Normalised lower-case text for search: title, provider, category, subcategory. */
  searchText: string
  /** Normalised lower-case title, for relevance scoring. */
  titleText: string
}

export type DataIssue = { recordId: string; issue: string; decision: string }

export type ExplorerIndex = {
  /** Visible services only (service active, provider active, category active). */
  services: ServiceView[]
  providers: ProviderView[]
  categories: CategoryNode[]
  categoryById: Map<string, CategoryNode>
  /** Subcategory id → parent category id. */
  subcategoryParents: Map<string, string>
  countries: { code: string; name: string; cities: { slug: string; name: string }[] }[]
  issues: DataIssue[]
  hidden: { inactiveService: number; inactiveProvider: number; inactiveCategory: number; unknownReference: number }
}

export const SORT_KEYS = ['relevance', 'price_asc', 'price_desc', 'rating'] as const
export type SortKey = (typeof SORT_KEYS)[number]

type LocationFilter = { kind: 'city'; slug: string } | { kind: 'country'; code: string } | null

export type ExplorerFilters = {
  q: string
  types: ServiceType[]
  categoryIds: string[]
  subCategoryIds: string[]
  providerIds: number[]
  location: LocationFilter
  currency: Currency | null
  min: number | null
  max: number | null
  homeTest: boolean
  sort: SortKey
  page: number
}

export const DEFAULT_FILTERS: ExplorerFilters = {
  q: '',
  types: [],
  categoryIds: [],
  subCategoryIds: [],
  providerIds: [],
  location: null,
  currency: null,
  min: null,
  max: null,
  homeTest: false,
  sort: 'relevance',
  page: 1,
}
