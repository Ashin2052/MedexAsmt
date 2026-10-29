import { beforeEach, describe, expect, it } from 'vitest'
import { captureMockFlags, clearMockRules, getMockRules, parseMockRules, takeMockHeaders } from './mockFlags'

const arm = (value: string) => {
  window.history.pushState(null, '', `/cart?mock=${encodeURIComponent(value)}&keep=1`)
  captureMockFlags()
}

beforeEach(() => clearMockRules())

describe('parseMockRules', () => {
  it('reads target, optional nth and effect; ignores malformed rules', () => {
    expect(parseMockRules('checkout#2:500, slots:SLOW,bookings:409,checkout:lost,cart:200,nope,x:abc')).toEqual([
      { target: 'checkout', nth: 2, effect: '500', seen: 0 },
      { target: 'slots', nth: 1, effect: 'slow', seen: 0 },
      { target: 'bookings', nth: 1, effect: '409', seen: 0 },
      { target: 'checkout', nth: 1, effect: 'lost', seen: 0 },
    ])
  })
})

describe('captureMockFlags + takeMockHeaders', () => {
  it('removes ?mock= from the URL so a reload does not re-arm the rules', () => {
    arm('checkout:500')
    expect(window.location.search).toBe('?keep=1')
    expect(getMockRules()).toHaveLength(1)
    expect(JSON.parse(sessionStorage.getItem('medex.mockFlags.v1') ?? '[]')).toHaveLength(1)
  })

  it('fails only the nth matching request, once', () => {
    arm('checkout#2:500')
    expect(takeMockHeaders('GET', '/api/cart').headers).toEqual({})
    expect(takeMockHeaders('POST', '/api/checkout').headers).toEqual({})
    expect(takeMockHeaders('POST', '/api/checkout').headers).toEqual({ 'x-mock-fault': '500' })
    expect(takeMockHeaders('POST', '/api/checkout').headers).toEqual({})
    expect(getMockRules()).toEqual([])
  })

  it('combines a delay and a fault on the same request', () => {
    arm('slots:slow,slots:500')
    expect(takeMockHeaders('GET', '/api/booking/providers/48/slots').headers).toEqual({ 'x-mock-delay': '3000', 'x-mock-fault': '500' })
  })

  it('an aborted request gives its rules back (StrictMode cancels the first dev fetch)', () => {
    arm('explorer/services:500,checkout#2:402')
    const aborted = takeMockHeaders('GET', '/api/explorer/services')
    expect(aborted.headers).toEqual({ 'x-mock-fault': '500' })
    takeMockHeaders('POST', '/api/checkout') // a concurrent request counts towards another rule
    aborted.restore()
    expect(getMockRules()).toEqual([
      { target: 'checkout', nth: 2, effect: '402', seen: 1 },
      { target: 'explorer/services', nth: 1, effect: '500', seen: 0 },
    ])
    expect(takeMockHeaders('GET', '/api/explorer/services').headers).toEqual({ 'x-mock-fault': '500' })
  })

  it('?mock=off clears the rules', () => {
    arm('cart:500')
    arm('off')
    expect(getMockRules()).toEqual([])
    expect(sessionStorage.getItem('medex.mockFlags.v1')).toBeNull()
  })
})
