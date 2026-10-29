# MedEx JSON Server mock API

This folder contains the local replication server. It uses **JSON Server 0.17.4** for Task 1 collection endpoints and custom Express routes for Task 2 and Task 3 workflows.

## Install and run

```bash
npm install
npm run dev
```

Default URL: `http://localhost:4010`.

Optional environment variable: `MOCK_API_PORT` (default `4010`).

Every `/api` response waits a fixed **1.5 seconds** (`RESPONSE_DELAY_MS` in `server.cjs`), so the app's loading skeletons are visible, as they would be against a real server. `/health` answers immediately. Tests create the app with `createApp({ delayMs: 0 })`.

## Fault injection (opt-in, per request)

Two request headers change one request. The app sends them only for `?mock=` rules (see the root README, §4.2), so without them nothing changes:

- `x-mock-delay: <ms>` adds latency on top of the fixed delay (capped at 30 s).
- `x-mock-fault: <status>` (400–599) answers with that status before the route runs, so nothing is created or changed.
- `x-mock-fault: lost` runs the route (an order or booking may be created), then replaces the reply with a `504`. Replaying the same idempotency key returns the original result.
- `x-mock-fault: 409` on `POST /api/bookings` or `PUT /api/bookings/:id` marks the requested time as taken by another customer (`takeSlot`), so the route answers with its real `slot-taken` 409 and genuine alternatives.

Tests: `mock-api/server.test.mjs`.

The server reads fixtures from `../data/`. Do not move or duplicate the original JSON files into this folder.

## Task 1 — JSON Server collections

- `GET /api/explorer/categories`
- `GET /api/explorer/providers`
- `GET /api/explorer/services`

JSON Server query options such as `_limit`, `_page`, `_sort` and `_order` are available. The UI should still own the assessment-specific multi-filter/facet semantics unless you intentionally implement them server-side.

## Task 2 — cart and checkout

- `GET /api/cart` → `{ cart }`
- `PATCH /api/cart/items/:lineId` with `{ quantity }`
- `PATCH /api/cart/items/:lineId` with `{ wellnessPricingId }`
- `DELETE /api/cart/items/:lineId` → `204`
- `GET /api/cart/guest-sample` → `{ items }` (the fixture's guest cart)
- `POST /api/cart/merge` with `{ items, mergeId }` → `{ cart, changes }` (the same `mergeId` returns the first result)
- `POST /api/checkout` with `{ groupType, items?, paymentMethod, idempotencyKey }` → `201 { orderId, status }`
- `GET /api/orders/:orderId` → `{ orderId, status }` (card orders go from `pending` to `paid` after about 2.5 s; pay-at-clinic orders stay `pending`)

Checkout is per group. The client should call it separately for each group, preserve successful order IDs, and retry only failed groups. The same idempotency key and same request payload return the same order response. Reusing a key with a different payload returns `409`.

The mock starts with the given cart and guest cart. A successful checkout removes the selected lines from the in-memory cart. Orders and mutations remain available across a browser refresh while this mock API process stays running; restarting the server reloads the original fixtures.

## Task 3 — booking

- `GET /api/booking/providers` → `{ providers }`
- `GET /api/booking/providers/:id` → `{ provider }`
- `GET /api/booking/providers/:id/calendar?specialistId=...&people=1[&excludeBookingId=...]` → `{ providerId, timezone, today, days[90] }` (each day has a `status`, a `message` and a `freeCount`)
- `GET /api/booking/providers/:id/slots?date=YYYY-MM-DD&specialistId=...&people=1[&excludeBookingId=...]` → the day's `status`, `window` and `slots` (each slot has UTC instants and a `state`: free / booked / past / insufficient)
- `GET /api/bookings/:id` → `{ booking }` (`existing` is an alias for the fixture booking)
- `POST /api/bookings` with `{ providerId, specialistId, date, startTime, numberOfPeople, idempotencyKey }` → `201` booking
- `PUT /api/bookings/:id` with `{ date, startTime, idempotencyKey }` → the booking with `status: "rescheduled"`

If the time is no longer free, both write routes return `409 { code: "slot-taken", alternatives: ["HH:mm", …] }`. The same idempotency key with the same payload returns the first result.

Fixture day offsets become dates when the mock starts. After that, "today" and the 90-day window follow each provider's live clock, so they roll over at the provider's midnight even if the mock keeps running.

The slots endpoint returns provider-local slot labels and availability metadata. It handles the seed closure/booked-slot data, provider weekly hours, specialist consultation duration/buffer, provider-local past-time checks, the 90-day horizon and group booking availability. The frontend remains responsible for displaying a clear customer-local converted clock alongside provider-local time.

Timezone values are normalized as follows:

- Recognized IANA values are used directly.
- `Nepal Standard Time`, `(GMT+5:45)`, `UTC+05:45`, `UTC+0545`, and `Asia/Katmandu` map to `Asia/Kathmandu`.
- Empty or unrecognized values fall back by country: TH → `Asia/Bangkok`, NP → `Asia/Kathmandu`, IN → `Asia/Kolkata`.
- The provider response includes `timezone: { raw, zone, source, note }`, so the UI can explain a fallback.

## Limitations

This is an intentionally small local simulation. It is not secure, durable, multi-user or production-ready. State is held in memory; restarting Node resets it to the original fixtures. Without the fault headers, errors come only from the real rules (for example a 409 when a slot was already booked, or a 422 for an invalid quantity). Do not deploy this mock API publicly.

## Where the original assessment inputs live

The server reads the untouched source fixtures from the repository-root `data/` folder. Do not move them into this folder and do not import them from frontend code. Original PDF briefs are in `assessment-briefs/` and are reference documents, not assets to serve to the browser.
