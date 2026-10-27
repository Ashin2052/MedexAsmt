import {
  parseCollection,
  rawCategorySchema,
  rawProviderSchema,
  rawServiceSchema,
} from '../features/service-explorer/api/schemas'
import { buildExplorerIndex } from '../features/service-explorer/domain/normalize'
import type { ExplorerIndex } from '../features/service-explorer/types'
import { explorerFixture } from './fixtures'

let cached: ExplorerIndex | null = null

/** The explorer index built from the real 3,200-service fixture. */
export function fixtureIndex(): ExplorerIndex {
  if (cached) return cached
  const raw = explorerFixture()
  const categories = parseCollection(raw.categories, rawCategorySchema, 'category')
  const providers = parseCollection(raw.providers, rawProviderSchema, 'provider')
  const services = parseCollection(raw.services, rawServiceSchema, 'service')
  cached = buildExplorerIndex(
    { categories: categories.records, providers: providers.records, services: services.records },
    [...categories.issues, ...providers.issues, ...services.issues],
  )
  return cached
}
