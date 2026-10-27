# Prompt 03 — Implement Task 2: Multi-provider Cart and Split Checkout

You are implementing Task 2 in the MedEx assessment. Read the complete `assessment-briefs/task2_cart_split_checkout.pdf` and inspect the complete `data/task2-cart.json` before coding. Follow `CLAUDE.md` and use the `/cart-checkout` skill.

## First: inspect and plan
- Trace the current app's API and data patterns.
- Inspect every server cart group, line item, catalog item, and guestCart item.
- Identify actual duplicate product IDs, missing catalog IDs, empty products, and wellness duration conflicts.
- Write a short plan listing exact files, API methods, state transitions, and tests. Do not code until the plan is coherent.

## Required implementation
1. Build a cart grouped by service type. Show each group's subtotal by currency; no combined grand total across currencies.
2. Treat `product.price` as the final per-unit cart price. Do not recalculate service discount/charge formulas.
3. Show line quantities and support quantity updates, removal, and loading/error feedback.
4. Quantity update must be optimistic. Rapid taps on one line must not race. Use a per-line serial queue or coalescing strategy; only reconcile the latest desired quantity. On failure, restore the last confirmed server quantity and explain the error.
5. Wellness line must have an explicit duration selection before it is priced or that group can be checked out. A missing choice is `unpriced`, never `0`.
6. Empty/missing product must be marked unavailable, excluded from checkout, and removable.
7. Implement guest cart merge. Decide and document how matching product IDs affect quantity, how the wellness duration selection is handled, and what happens to unknown/unavailable guest products. Return a visible change summary (`added`, `quantity combined`, `wellness choice applied/needs choice`, `skipped/unavailable`). Never silently discard a guest item.
8. Allow checkout of one group or all eligible groups. Each group creates a separate order and has its own payment method (`card` or `pay_at_clinic`).
9. Model checkout as explicit per-group states (at minimum: ready, submitting, pending/unknown, succeeded, failed). One group's failure must not erase successful orders.
10. Use an idempotency key for each group checkout attempt. Persist the checkout intent/key before calling POST so a refresh or network interruption does not start a new order. Reconcile saved order IDs through GET `/orders/:orderId` after reload. A retry of an outcome-unknown request must reuse its key; do not create duplicate orders.
11. Implement 402/409/500/network error behavior with distinct customer messages. Keep selections and successful groups intact. Allow retry only for appropriate failed/unknown groups.
12. Add mock API latency/failure injection that a reviewer can trigger from a small development-only control or documented query flag.

## Suggested mock API contract
- `GET /api/task2/cart`
- `PATCH /api/task2/cart/items/:lineId` — quantity or `wellnessPricingId`
- `DELETE /api/task2/cart/items/:lineId`
- `POST /api/task2/cart/merge`
- `POST /api/task2/checkout`
- `GET /api/task2/orders/:orderId`

Adapt to existing route conventions if already established. Keep business rules in pure functions/service modules, not route handlers or React components.

## Tests to add
- matching guest/server product quantities combine correctly;
- new catalog item is added;
- unknown guest product is reported/skipped safely;
- guest wellness choice is applied or clearly surfaced;
- unpriced wellness blocks checkout;
- missing product cannot be checked out and can be removed;
- currency totals remain separate;
- rapid quantity clicks cannot resolve out of order;
- one group succeeds while another fails; retry only failed/unknown group;
- same idempotency key returns same order;
- refresh/reload reconciles order state and does not duplicate checkout.

## Finish
Run focused tests, lint, typecheck, and build. Update README and `docs/ASSESSMENT_DECISIONS.md`. Report what is complete, what is deliberately incomplete, and the exact manual steps to demonstrate partial failure and reload safety.
