// Boundary validation for the three explorer collections. Schemas are lenient
// per field (`.catch`) so one malformed value never fails the whole load;
// records missing an identity field are rejected individually and reported.
import { z } from 'zod'
import type { DataIssue } from '../types'

const decimal = z.union([z.string(), z.number()]).nullable().catch(null)
const nullableString = z.string().nullable().catch(null)

const priceTerms = {
  price: decimal,
  discount: decimal,
  discountType: nullableString,
  serviceCharge: decimal,
  serviceChargeType: nullableString,
}

export const rawWellnessOptionSchema = z.object({
  id: z.string().catch(''),
  durationInMinutes: z.number().nullable().catch(null),
  ...priceTerms,
})

export const rawServiceSchema = z.object({
  id: z.string().min(1),
  title: z.string().catch(''),
  type: z.string(),
  userId: z.number(),
  categoryId: nullableString,
  subCategoryId: nullableString,
  ...priceTerms,
  status: z.boolean().catch(false),
  testAtHome: z.boolean().catch(false),
  homeTestCharge: decimal,
  wellnessPricing: z.array(rawWellnessOptionSchema).catch([]),
})

export const rawProviderSchema = z.object({
  id: z.number(),
  name: z.string().catch(''),
  status: z.string().catch('inactive'),
  providerInformation: z.object({
    currency: z.string(),
    city: z.object({ name: z.string(), slug: z.string() }),
    country: z.object({ name: z.string(), alphaCode: z.string() }),
    rating: z.number().nullable().catch(null),
    reviewCount: z.number().nullable().catch(null),
  }),
})

const rawCategoryBase = {
  id: z.string().min(1),
  title: z.string().catch(''),
  slug: z.string().catch(''),
  type: z.string(),
  position: z.number().catch(0),
  status: z.boolean().catch(false),
  parentId: nullableString,
}

export const rawCategorySchema = z.object({
  ...rawCategoryBase,
  children: z.array(z.object(rawCategoryBase)).catch([]),
})

type RawService = z.infer<typeof rawServiceSchema>
type RawProvider = z.infer<typeof rawProviderSchema>
type RawCategory = z.infer<typeof rawCategorySchema>

export type RawExplorerData = {
  categories: RawCategory[]
  providers: RawProvider[]
  services: RawService[]
}

/** Validate each record independently; invalid records are dropped and reported. */
export function parseCollection<T>(
  input: unknown,
  schema: z.ZodType<T>,
  collection: string,
): { records: T[]; issues: DataIssue[] } {
  if (!Array.isArray(input)) {
    throw new Error(`The ${collection} response was not a list.`)
  }
  const records: T[] = []
  const issues: DataIssue[] = []
  input.forEach((item, position) => {
    const result = schema.safeParse(item)
    if (result.success) {
      records.push(result.data)
    } else {
      const id = item && typeof item === 'object' && 'id' in item ? String(item.id) : `#${position}`
      issues.push({ recordId: `${collection}:${id}`, issue: 'Malformed record', decision: 'Excluded from results' })
    }
  })
  return { records, issues }
}
