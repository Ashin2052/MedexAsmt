// Task 2 data access against mock-api (/api/cart, /api/checkout, /api/orders).
import { z } from 'zod'
import { apiRequest } from '@/shared/api/client'
import type { CheckoutItems, GuestCartItem, MergeChange, OrderStatus, PaymentMethod } from '../types'
import { mergeChangeSchema, orderSchema, rawCartSchema, type RawCart } from './schemas'

const cartEnvelope = z.object({ cart: rawCartSchema })

export async function fetchCart(signal?: AbortSignal): Promise<RawCart> {
  return cartEnvelope.parse(await apiRequest<unknown>('/api/cart', { signal })).cart
}

export async function updateQuantity(lineId: string, quantity: number): Promise<RawCart> {
  const body = await apiRequest<unknown>(`/api/cart/items/${encodeURIComponent(lineId)}`, {
    method: 'PATCH',
    body: { quantity },
  })
  return cartEnvelope.parse(body).cart
}

export async function chooseWellnessOption(lineId: string, wellnessPricingId: string): Promise<RawCart> {
  const body = await apiRequest<unknown>(`/api/cart/items/${encodeURIComponent(lineId)}`, {
    method: 'PATCH',
    body: { wellnessPricingId },
  })
  return cartEnvelope.parse(body).cart
}

export async function removeLine(lineId: string): Promise<void> {
  await apiRequest<void>(`/api/cart/items/${encodeURIComponent(lineId)}`, { method: 'DELETE' })
}

export async function fetchGuestSample(): Promise<GuestCartItem[]> {
  const body = z
    .object({
      items: z.array(z.object({ productId: z.string(), quantity: z.number(), wellnessPricingId: z.string().optional() })),
    })
    .parse(await apiRequest<unknown>('/api/cart/guest-sample'))
  return body.items
}

export async function mergeGuestCart(
  items: GuestCartItem[],
  mergeId: string,
): Promise<{ cart: RawCart; changes: MergeChange[] }> {
  const body = await apiRequest<unknown>('/api/cart/merge', { method: 'POST', body: { items, mergeId } })
  return z.object({ cart: rawCartSchema, changes: z.array(mergeChangeSchema) }).parse(body)
}

export async function postCheckout(input: {
  groupType: string
  items: CheckoutItems
  paymentMethod: PaymentMethod
  idempotencyKey: string
}): Promise<{ orderId: string; status: OrderStatus }> {
  return orderSchema.parse(await apiRequest<unknown>('/api/checkout', { method: 'POST', body: input }))
}

export async function fetchOrder(orderId: string): Promise<{ orderId: string; status: OrderStatus }> {
  return orderSchema.parse(await apiRequest<unknown>(`/api/orders/${encodeURIComponent(orderId)}`))
}

