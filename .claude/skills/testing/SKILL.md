---
name: testing
description: How to write and run tests in this repo with Vitest 5, jsdom and Testing Library — what to test at which layer, the real mock server helper (startMockServer, FIXED_NOW), fixture helpers, deterministic time, accessible queries, and verifying a change with typecheck/lint/test/build. Use when adding or changing tests, testing a new feature or bug fix, running the verification gate, or deciding what coverage a change needs.
---

# Testing (MedEx)

## Layers: test the lowest layer that proves the rule
1. **Domain** (`features/*/domain/*.test.ts`): pure functions such as pricing, facets, grouping, cart, checkout, merge, time, slots and calendar. These are fast, so cover edge cases and boundaries here.
2. **Hooks** (`hooks/*.test.ts`): only for hooks with real stateful logic (`useQuantityQueue`, `useCheckout`). Use `renderHook`.
3. **Pages** (`components/*.test.tsx`): one test per important user workflow and error state, run against the real mock.
4. **Mock rules** (`mock-api/lib/*.test.mjs`): the server's contract and rules.
- Don't add snapshot tests or tests of implementation details (internal state, which hook was called).

## Helpers (`src/test/`)
- **`startMockServer()`** runs the real `mock-api/server.cjs` on a random port. It returns:
  - `fetch`: stub it with `vi.stubGlobal('fetch', server.fetch)`
  - `calls` and `callsTo(method, path)`
  - `cart()` and `booking()`: server state
  - `advance(ms)`: moves the clock
  - `failNext(method, path, failure, skip?)`: fails a request (see below)
  - `close()`: call it in `afterEach`
- **`FIXED_NOW`** is Mon 26 Oct 2026 10:00 Bangkok. Seeded bookings cover day offsets 0–29, so use later dates when a test needs an empty day.
- **Fixtures:** `explorerFixture()` and `fixtureIndex()` for Task 1 data, `fixtureCart()` for the starting cart. Load fixtures only through these helpers, never by importing `data/*.json` from app code.
- **Each page test:** clear `localStorage` and use a fresh `QueryClient` with `retry: false`. Use `createMemoryRouter` with `initialEntries` for URL state. See `CartPage.test.tsx` for the pattern.
- **Failures:** `server.failNext(method, path, status | 'lose-response', skip?)` fails the next matching request in the stubbed `fetch`; the mock API itself never fails. For a real conflict, make the competing request first with `server.forward(...)` (see `BookingPage.test.tsx`).

## Writing tests
- Use accessible queries: `getByRole(name)`, `getByLabelText`, `findBy*` for async. Use `getByTestId` only as a last resort.
- `userEvent.setup()` for interactions; `within(region)` to scope.
- Assert on what the user sees and what the server received, never on internals.
- Name tests after the behaviour: `it('keeps the selection and offers alternatives after a 409')`.
- Keep tests deterministic: freeze time with `FIXED_NOW` or `vi.setSystemTime`, never use real sleeps, and generate random IDs only in code under test.
- Never weaken, skip or delete a failing test to get green. Fix the code, or ask if the test is wrong.

## What a change needs
- **New or changed business rule:** domain tests for the normal case plus edges (empty, boundary, mixed currency, DST or day-crossing, malformed input).
- **Bug fix:** a regression test that failed before the fix.
- **New async flow:** loading, error with retry, and conflict or unknown outcome where writes happen.
- **UI-only change:** usually nothing new. Run the existing page tests and check the page manually.

## Run
```bash
npx vitest run src/features/cart-checkout/domain/cart.test.ts   # one file
npx vitest run -t "idempotency"                                    # by name
npm test                                                           # all
npm run typecheck && npm run lint && npm run build                 # the full gate
```
Report the real pass/fail counts and paste the failure output. Never claim a result you didn't run.
