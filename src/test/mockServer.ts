// Runs the real mock API (mock-api/server.cjs) on a random port for tests.
// fetch() is stubbed to forward the app's same-origin /api calls to it, and
// every call is recorded. The clock is fixed and can be advanced, and
// failNext() simulates a failed request (the mock API itself never fails).
import type { Server } from 'node:http'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { vi } from 'vitest'

/** Monday 26 Oct 2026, 10:00 in Bangkok (08:45 in Kathmandu). */
export const FIXED_NOW = Date.UTC(2026, 9, 26, 3, 0)

type ServerState = {
  cart: { cart: { groups: { type: string; items: { id: string; quantity: number }[] }[] }; orders: Map<string, unknown> }
  booking: { bookings: Map<string, unknown>; providers: { id: number; specialists: { id: string }[] }[] }
}

/**
 * - a status: the request never reaches the server; it answers with that status
 * - 'lose-response': the server handles the request, then the reply is lost
 */
type Failure = number | 'lose-response'
type App = { listen(port: number, ready: () => void): Server; locals: { state(): ServerState } }

const requireFromRoot = createRequire(resolve(process.cwd(), 'package.json'))
const { createApp } = requireFromRoot('./mock-api/server.cjs') as {
  createApp(options: { now: () => number; delayMs: number }): App
}

/** The fixture cart as the mock serves it on start-up (no server needed). */
export function fixtureCart(): unknown {
  return createApp({ now: () => FIXED_NOW, delayMs: 0 }).locals.state().cart.cart
}

export async function startMockServer() {
  let clock = FIXED_NOW
  const app = createApp({ now: () => clock, delayMs: 0 })
  const server = await new Promise<Server>((ready) => {
    const s = app.listen(0, () => ready(s))
  })
  const address = server.address()
  const origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
  const realFetch = globalThis.fetch
  const calls: { method: string; path: string; body: unknown }[] = []
  const failures: { method: string; path: string; failure: Failure; skip: number }[] = []

  const forward = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), origin)
    const method = init?.method ?? 'GET'
    calls.push({ method, path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined })

    const index = failures.findIndex((f) => f.method === method && f.path === url.pathname)
    const planned = index >= 0 ? failures[index] : undefined
    if (planned && planned.skip > 0) planned.skip -= 1
    else if (planned) {
      failures.splice(index, 1)
      if (planned.failure !== 'lose-response') {
        return Response.json({ message: `Simulated ${planned.failure}.` }, { status: planned.failure })
      }
      await realFetch(url, { ...init, signal: undefined })
      throw new TypeError('fetch failed')
    }
    // jsdom's AbortSignal is not accepted by Node's fetch; tests don't abort.
    return realFetch(url, { ...init, signal: undefined })
  }

  return {
    fetch: vi.fn(forward),
    /** Fail the next matching request (after letting `skip` matching requests through). */
    failNext: (method: string, path: string, failure: Failure, skip = 0) => {
      failures.push({ method, path, failure, skip })
    },
    forward,
    calls,
    callsTo: (method: string, path: string) => calls.filter((c) => c.method === method && c.path === path),
    cart: () => app.locals.state().cart,
    booking: () => app.locals.state().booking,
    advance: (ms: number) => {
      clock += ms
    },
    close: () => new Promise<void>((done) => server.close(() => done())),
  }
}
