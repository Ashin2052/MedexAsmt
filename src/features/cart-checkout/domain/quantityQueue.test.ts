import { describe, expect, it } from 'vitest'
import { requestQuantity, settleFailure, settleSuccess } from './quantityQueue'

describe('quantity queue', () => {
  it('sends the first change immediately and holds later taps', () => {
    const first = requestQuantity(null, 1, 2)
    expect(first).toEqual({ queue: { confirmed: 1, desired: 2, inFlight: 2 }, send: 2 })
    const second = requestQuantity(first.queue, 1, 3)
    expect(second).toEqual({ queue: { confirmed: 1, desired: 3, inFlight: 2 }, send: null })
  })

  it('coalesces five rapid taps into two ordered requests and ends on the last value', () => {
    let step = requestQuantity(null, 1, 2)
    const sent = [step.send]
    for (const desired of [3, 4, 5, 6]) step = requestQuantity(step.queue, 1, desired)
    expect(step.send).toBeNull()
    step = settleSuccess(step.queue!, 2)
    sent.push(step.send)
    expect(step.queue).toEqual({ confirmed: 2, desired: 6, inFlight: 6 })
    step = settleSuccess(step.queue!, 6)
    expect(step).toEqual({ queue: null, send: null })
    expect(sent).toEqual([2, 6])
  })

  it('does nothing when the customer returns to the confirmed quantity', () => {
    expect(requestQuantity(null, 3, 3)).toEqual({ queue: null, send: null })
  })

  it('rolls back to the last confirmed quantity on failure, dropping pending taps', () => {
    const step = requestQuantity(requestQuantity(null, 2, 3).queue, 2, 5)
    expect(settleFailure(step.queue!)).toEqual({ queue: null, rollbackTo: 2 })
  })

  it('after a partial success then failure, rolls back to the latest confirmed value', () => {
    let step = requestQuantity(null, 1, 2)
    step = requestQuantity(step.queue, 1, 4)
    step = settleSuccess(step.queue!, 2) // first request confirmed 2, now sending 4
    expect(settleFailure(step.queue!).rollbackTo).toBe(2)
  })
})
