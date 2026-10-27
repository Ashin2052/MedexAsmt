// Per-line serial queue for optimistic quantity changes.
//
// The UI shows `desired` immediately. At most one request per line is in
// flight; taps made meanwhile only move `desired`. When the request settles,
// the latest `desired` is sent if it still differs from what the server
// confirmed. Five quick taps therefore produce at most two requests, always in
// order, and a slow early response can never overwrite a later choice.
// On failure the line returns to the last server-confirmed quantity.

export type LineQueue = {
  /** Last quantity the server confirmed. */
  confirmed: number
  /** What the customer currently sees and wants. */
  desired: number
  /** Quantity of the request in flight, or null when idle. */
  inFlight: number | null
}

export type QueueStep = {
  /** Next queue state; null means the line is settled and needs no tracking. */
  queue: LineQueue | null
  /** Quantity to send now, if any. */
  send: number | null
}

export function requestQuantity(current: LineQueue | null, serverQuantity: number, desired: number): QueueStep {
  const base = current ?? { confirmed: serverQuantity, desired: serverQuantity, inFlight: null }
  const next: LineQueue = { ...base, desired }
  if (base.inFlight !== null) return { queue: next, send: null }
  if (desired === base.confirmed) return { queue: null, send: null }
  return { queue: { ...next, inFlight: desired }, send: desired }
}

export function settleSuccess(current: LineQueue, serverQuantity: number): QueueStep {
  const next: LineQueue = { ...current, confirmed: serverQuantity, inFlight: null }
  if (next.desired === serverQuantity) return { queue: null, send: null }
  return { queue: { ...next, inFlight: next.desired }, send: next.desired }
}

/** The request failed: forget pending taps and show the confirmed quantity again. */
export function settleFailure(current: LineQueue): { queue: null; rollbackTo: number } {
  return { queue: null, rollbackTo: current.confirmed }
}
