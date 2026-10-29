---
name: debugging
description: Systematic debugging workflow for this Vite + React + mock-API app — reproducing with the mock's delay/failure/conflict flags, isolating whether a bug is in the domain function, API boundary (Zod/ApiError), React state/effects, or mock server, and fixing the root cause with a regression test. Use when something is broken, a test fails, the UI shows wrong data/prices/times, requests fail or race, or behaviour differs from the brief.
---

# Debugging (MedEx)

Find the root cause before changing code. Never fix a symptom by loosening a schema, swallowing an error, or weakening a test.

## 1. Reproduce
- Restate the expected behaviour, citing the brief or `CLAUDE.md` rule, and the actual behaviour.
- Reproduce it as cheaply as possible, in this order:
  1. **A unit test** against the pure `domain/` function with fixture data (`explorerFixture()`, `fixtureIndex()`, `fixtureCart()`).
  2. **A component test** with `startMockServer()`. Use `server.advance(ms)` for time and `server.calls`/`callsTo()` to inspect requests.
  3. **The running app** via `npm run dev`. Every API response takes 1.5 s; use the page's Refresh button (above the list) to re-fetch. There is no failure injection, so reproduce error paths in a test with `server.failNext(...)`.
- Check API responses directly with `node -e "fetch('http://localhost:4010/api/cart').then(r=>r.json()).then(console.log)"` (`curl` is not installed).

## 2. Isolate the layer
Follow the data from fixture to screen and find the first point where it is wrong:
1. **Fixture** (`data/*.json`): is the input what you assume? Check the odd records (empty products, `ultrasound` slug duplicates, six time-zone formats).
2. **Mock** (`mock-api/lib/*.cjs`): does the route return the contract in `mock-api/README.md` (also the README's API endpoint table)? Mock state is in memory, so restart it to rule out stale state.
3. **API boundary** (`features/*/api/`): a Zod parse error means the contract and schema disagree. Fix the side that's wrong; don't use `.passthrough()` or `any` to silence it. Check `ApiError.kind` and `status`.
4. **Domain** (`features/*/domain/`): call the pure function with the exact input.
5. **React**: stale query data (key or invalidation), effects firing twice (StrictMode), derived values stored in state, missing `key`, or a race between overlapping requests.

## 3. Common causes in this repo
- **Time:** a provider date computed in the customer's zone, `dayOffset` applied to the wrong date, past-slot checks with the wrong clock, DST. Tests must use `FIXED_NOW`; seeded bookings cover only day offsets 0–29.
- **Money:** rounding before the end of a calculation, a missing currency, two currencies summed, wellness treated as 0.
- **Identity:** keying by category slug instead of ID.
- **Async:** quantity updates out of order, retrying with a new idempotency key when the outcome was unknown, a double submit.
- **URL state:** default values written to the URL and creating history entries, or back/forward not restoring the view.
- **jsdom:** Radix needs the ResizeObserver stub (`src/test/setup.ts`), and jsdom's `AbortSignal` is dropped by the mock forwarder.

## 4. Fix and prove
1. Write a failing test that captures the bug, in the lowest layer that shows it.
2. Make the smallest fix at the root cause, then watch the test pass.
3. Run `npx vitest run <affected files>`, then the full `npm test`, `npm run typecheck` and `npm run lint`.
4. Report the cause, the fix and the evidence (test names and output). If something stays unexplained, say so instead of guessing.
