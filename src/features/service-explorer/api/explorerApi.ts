// Task 1 data access: the three collections served by the mock API's JSON
// Server router. Raw records are validated here and turned into the view
// model once; components never see raw API shapes.
import { apiRequest } from '../../../shared/api/client'
import { buildExplorerIndex } from '../domain/normalize'
import type { ExplorerIndex } from '../types'
import { parseCollection, rawCategorySchema, rawProviderSchema, rawServiceSchema } from './schemas'

export async function fetchExplorerIndex(signal?: AbortSignal): Promise<ExplorerIndex> {
  const [categories, providers, services] = await Promise.all([
    apiRequest<unknown>('/api/explorer/categories', { signal }),
    apiRequest<unknown>('/api/explorer/providers', { signal }),
    apiRequest<unknown>('/api/explorer/services', { signal }),
  ])

  const parsedCategories = parseCollection(categories, rawCategorySchema, 'category')
  const parsedProviders = parseCollection(providers, rawProviderSchema, 'provider')
  const parsedServices = parseCollection(services, rawServiceSchema, 'service')

  return buildExplorerIndex(
    {
      categories: parsedCategories.records,
      providers: parsedProviders.records,
      services: parsedServices.records,
    },
    [...parsedCategories.issues, ...parsedProviders.issues, ...parsedServices.issues],
  )
}
