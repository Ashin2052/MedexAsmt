// Device storage for checkout intents and the guest cart. Writes are
// synchronous so an intent is saved before its request is sent.
import type { CheckoutRecord, GuestCartItem, MergeChange } from '../types'

export const CHECKOUT_KEY = 'medex.checkout.v1'
const GUEST_KEY = 'medex.guestCart.v1'

export type GuestCartState = {
  items: GuestCartItem[]
  /** Generated once and saved before merging, so a retried merge is idempotent. */
  mergeId: string
  mergedChanges: MergeChange[] | null
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable: the session still works, but reload safety is lost.
  }
}

export const loadCheckoutRecords = (): CheckoutRecord[] => read<CheckoutRecord[]>(CHECKOUT_KEY, [])
export const saveCheckoutRecords = (records: CheckoutRecord[]) => write(CHECKOUT_KEY, records)

export const loadGuestCart = (): GuestCartState | null => read<GuestCartState | null>(GUEST_KEY, null)
export const saveGuestCart = (state: GuestCartState) => write(GUEST_KEY, state)

