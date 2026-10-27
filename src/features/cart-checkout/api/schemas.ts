// Boundary validation for cart responses. Lines are validated one by one so a
// malformed product becomes an "unavailable" line instead of breaking the cart.
import { z } from 'zod'

export const rawWellnessOptionSchema = z.object({
  id: z.string(),
  durationInMinutes: z.number(),
  amount_after_service_charge: z.number(),
})

/** A product the customer can still buy. An empty object `{}` fails this on purpose. */
export const rawProductSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  type: z.string(),
  price: z.number().nullable(),
  currency: z.string(),
  providerId: z.number().optional(),
  providerName: z.string().optional(),
  wellnessPricing: z.array(rawWellnessOptionSchema).optional(),
})

const rawLineSchema = z.object({
  id: z.string(),
  productId: z.string(),
  quantity: z.number(),
  wellnessPricingId: z.string().optional(),
  product: z.unknown(),
})

export const rawCartSchema = z.object({
  groups: z.array(
    z.object({
      type: z.string(),
      items: z.array(rawLineSchema),
    }),
  ),
  totalItems: z.number().optional(),
})

export const mergeChangeSchema = z.object({
  productId: z.string(),
  lineId: z.string().optional(),
  title: z.string().nullable(),
  outcome: z.enum(['added', 'quantity-combined', 'skipped']),
  reason: z.string().optional(),
  quantity: z.number().optional(),
  from: z.number().optional(),
  added: z.number().optional(),
  to: z.number().optional(),
  capped: z.boolean().optional(),
  wellness: z
    .object({
      status: z.enum(['applied', 'kept-account-choice', 'needs-choice']),
      durationInMinutes: z.number().nullable().optional(),
    })
    .optional(),
})

export const orderSchema = z.object({
  orderId: z.string(),
  status: z.enum(['pending', 'paid', 'failed']),
})

export type RawLine = z.infer<typeof rawLineSchema>
export type RawCart = z.infer<typeof rawCartSchema>
