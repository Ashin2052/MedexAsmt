// @vitest-environment node
// Fault injection headers (opt-in; the app sends them only for ?mock= rules).
import { createRequire } from 'node:module'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { createApp } = require('./server.cjs')

const NOW = Date.UTC(2026, 9, 26, 3, 0) // Mon 26 Oct 2026, 10:00 Bangkok
const WONGSAKUL = '2a2f07eb-7886-4f83-82ab-ca56f415da44'

let server
let origin
let app

beforeAll(async () => {
  app = createApp({ now: () => NOW, delayMs: 0 })
  server = await new Promise((ready) => {
    const s = app.listen(0, () => ready(s))
  })
  origin = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => new Promise((done) => server.close(done)))

const post = (path, body, headers = {}) =>
  fetch(`${origin}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })

describe('mock fault injection', () => {
  it('answers with the requested status before the route runs (no order is created)', async () => {
    const orders = app.locals.state().cart.orders.size
    const res = await post('/api/checkout', { groupType: 'lab_test', paymentMethod: 'card', idempotencyKey: 'f1' }, { 'x-mock-fault': '500' })
    expect(res.status).toBe(500)
    expect(app.locals.state().cart.orders.size).toBe(orders)
  })

  it('"lost" runs the route, then replies 504; replaying the same key returns the same order', async () => {
    const body = { groupType: 'lab_test', paymentMethod: 'pay_at_clinic', idempotencyKey: 'lost-1' }
    const lost = await post('/api/checkout', body, { 'x-mock-fault': 'lost' })
    expect(lost.status).toBe(504)
    const orders = app.locals.state().cart.orders.size
    const replay = await post('/api/checkout', body)
    expect(replay.status).toBe(201)
    expect(app.locals.state().cart.orders.size).toBe(orders) // the lost request had created it
  })

  it('a booking 409 is a real conflict: the time is taken and alternatives are offered', async () => {
    const body = { providerId: 48, specialistId: WONGSAKUL, date: '2026-11-30', startTime: '10:40', numberOfPeople: 1, idempotencyKey: 'b1' }
    const res = await post('/api/bookings', body, { 'x-mock-fault': '409' })
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.code).toBe('slot-taken')
    expect(json.alternatives).toContain('11:20')
  })

  it('ignores unknown values and adds per-request delay', async () => {
    const started = Date.now()
    const res = await fetch(`${origin}/api/cart`, { headers: { 'x-mock-fault': 'nonsense', 'x-mock-delay': '200' } })
    expect(res.status).toBe(200)
    expect(Date.now() - started).toBeGreaterThanOrEqual(190)
  })
})
