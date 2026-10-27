# CLAUDE.md

MedEx frontend assessment: three tasks, all implemented. Task 1 is the Service Explorer (`/explorer`), Task 2 is Cart and split checkout (`/cart`), and Task 3 is Booking across time zones (`/booking`). Stack: Vite 8, React 19, TypeScript (strict), React Router 7, TanStack Query 5, Zod 4, Tailwind CSS 4, shadcn/ui (Radix), Lucide, Sonner and Vitest 5 (jsdom). The local API is `mock-api/` (JSON Server 0.17.4 + Express, Node >= 20).

## Commands
Run from the repo root:
```bash
npm install          # postinstall also installs mock-api/ dependencies
npm run dev          # scripts/dev.mjs: mock API (4010) + Vite; args go to Vite
npm run dev:web      # Vite only;  npm run dev:api = mock API only
npm run check:api    # smoke-check a running API (optional base URL, e.g. http://localhost:5173)
npm run typecheck    # tsc -b
npm run lint         # oxlint (.oxlintrc.json; mock-api/ ignored)
npm test             # vitest run;  npm run test:watch
npm run build        # tsc -b && vite build
npx vitest run <file>        # one file;  npx vitest run -t "<name>"  tests matching a name
```
`curl` is not installed: use `npm run check:api` or Node `fetch`. Installing `vitest` with npm 9 hits an npm bug (`edgesOut`); use `--legacy-peer-deps` for that package.

## Architecture
- **Layout:** `src/app/` (router, layout, providers), `src/shared/` (API client, money, app-level UI), `src/components/ui/` (shadcn primitives), and `src/features/<service-explorer|cart-checkout|appointment-booking>/{api,domain,hooks,components}`. `@/` is an alias for `src/`.
- **Domain modules:** files in `domain/` are pure and hold the business rules (pricing, facets, grouping, URL state, cart and checkout rules, time zones, slots). Components never contain business rules.
- **API:** every request goes through `apiRequest` in `src/shared/api/client.ts` (`ApiError` kinds `http|network|aborted|parse`, `isOutcomeUnknown`, `describeApiError`), and responses are parsed with Zod in each feature's `api/schemas.ts`. The browser calls same-origin `/api/*` and `/health`; `vite.config.ts` proxies them to `MOCK_API_URL` (default `http://localhost:4010`), and this proxy is the only API path. App code must never import `data/*.json`; `src/test/architecture.test.ts` enforces this.
- **Mock API:** `mock-api/server.cjs` exports `createApp({ now, delayMs })`.
  - Task 1 is a read-only JSON Server router at `/api/explorer`; Tasks 2–3 are Express routes over in-memory copies of `../data/*.json`.
  - Their rules live in `mock-api/lib/cart.cjs` and `mock-api/lib/booking.cjs` (`date-fns-tz`), each with its own `*.test.mjs`.
  - Every `/api` response waits a fixed 1.5 s (`RESPONSE_DELAY_MS`) so loading states are visible. There is no failure injection (removed by user decision, D-25); tests simulate failures with `failNext` in `src/test/mockServer.ts`. Env: `MOCK_API_PORT`.
  - State is in memory and resets on restart. The contract is documented in `mock-api/README.md` and the README's API endpoint table. Contract changes need user approval.
- **Tests:** colocated `*.test.ts(x)`. Helpers in `src/test/`: `mockServer.ts` (the real mock on a random port, `FIXED_NOW` = Mon 26 Oct 2026 10:00 Bangkok), `fixtures.ts`, `explorerIndex.ts`, and `setup.ts` (ResizeObserver stub for Radix). Test files are type-checked by `tsconfig.test.json`.
- **Design:** light theme only. Tokens are in `src/index.css`: white page, `surface` `#F8F7FB`, primary purple `#70208F`, magenta `#A43A9B`, teal `#26B6B0` (non-text only), text `#252238`. Never add `dark:` classes or a theme toggle.
- **Docs:** `README.md` is the submitted, high-level overview for reviewers: implementation, decisions, requirement coverage and limitations, not an exhaustive reference. `docs/` is **git-ignored**: detailed notes for the user's own study and interview preparation that exist only locally (decision log `docs/ASSESSMENT_DECISIONS.md` with D-xx ids, feature docs, `TECHNICAL_PLAN.md`, `CODING_STANDARDS.md`). Use them when present, but never link to them from tracked files. `../MedexTask` is a separate older project: never read from it or modify it.

## Source of truth
The briefs and fixtures define the requirements:
- `assessment-briefs/task1_service_explorer.pdf` with `data/task1-service-explorer.json`
- `assessment-briefs/task2_cart_split_checkout.pdf` with `data/task2-cart.json`
- `assessment-briefs/task3_booking_time_zones.pdf` with `data/task3-booking.json`

Read the relevant brief before changing a feature's behaviour. Never silently invent or simplify a requirement; record ambiguities and decisions in `README.md` (and the local decision log if present).

## Correctness rules (do not simplify away)
**Task 1, Service Explorer**
- Visible means service status `true`, provider `active`, and category status `true` when a category exists.
- Identify categories by ID, never by slug alone (duplicate `ultrasound` slugs exist).
- Use the brief's exact pricing formula; never round intermediate money.
- Wellness shows labelled option prices.
- Never mix THB, NPR or INR, and never convert between them.
- The URL is the source of truth for filters, sort and page.
- A facet's counts exclude that facet's own filter.
- Show at most 3 preview services per provider, with correct filtered counts.
- Back performance claims for 3,200 services with measurements.

**Task 2, Cart and checkout**
- `product.price` is already the final unit price.
- Never add different currencies together.
- Wellness without `wellnessPricingId` is unpriced (not 0) and blocks its group.
- Missing products are unavailable, excluded from checkout and removable.
- Serialise and coalesce quantity updates per line.
- Each group is a separate order; keep partial successes.
- Persist the idempotency intent before the POST, reconcile after a reload, and never let retries duplicate an order.
- Guest merge reports added, combined, updated and skipped items.

**Task 3, Booking**
- Schedule times are in the provider's time zone.
- `dayOffset` is relative to the provider-local date.
- Normalise time zones, falling back by country: TH → `Asia/Bangkok`, NP → `Asia/Kathmandu`, IN → `Asia/Kolkata`.
- Slot cadence is duration + buffer.
- An appointment must fit both the specialist's and the provider's hours.
- A group of N needs N consecutive free slots with the same specialist.
- Disable past slots by the provider's clock, and show provider and customer times.
- The booking window is 90 days.
- Keep selections after a 409 or an error, and show alternatives.

## Coding principles
- The simplest correct solution wins. Don't add abstractions, hooks, generics or files without a second real use.
- Reuse what's installed before writing custom code, and don't add a dependency for trivial logic.
- Strict TypeScript with no unjustified `any`. Use `unknown` and Zod at boundaries, and discriminated unions over boolean flags.
- Delete dead code; don't leave it commented out or re-exported "just in case".
- Topic skills in `.claude/skills/` (frontend-design, react-best-practices, clean-code, debugging, testing) load when relevant.

## Workflow
1. Check `git status` first and preserve user changes. Before editing, state which files will change and which tests will be added.
2. Work in small, feature-sized slices. Put rules in pure `domain/` functions with tests.
3. After each slice, run the focused tests, then `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`. Report real output only; never claim a check, accessibility result or performance figure that wasn't measured.
4. Update `README.md` when behaviour, setup, decisions or limitations change: it is the only documentation in the repository.
5. Never commit `.env`, credentials, `dist/`, `node_modules/` or coverage. Commit only when asked.


## Documentation Maintenance (local `docs/` notes)

The `docs/` folder is git-ignored personal reference material. When it exists locally, keep it synchronized with the implementation, but never link to it from tracked files (README, `mock-api/README.md`, skills). The README rules below take priority.

Whenever a feature is created, modified, refactored or removed:

1. Update its corresponding feature documentation.
2. Document important implementation changes.
3. Update execution flows and diagrams when necessary.
4. Update API and database documentation when contracts or schemas change.
5. Update `docs/features/FEATURE_INDEX.md`.
6. Update `docs/PROJECT_DOCUMENTATION.md` when its structure or index changes.

For new features, document:
- Purpose and functionality.
- Source files and responsibilities.
- Important functions and execution flow.
- API interactions and data flow.
- Dependencies and technical decisions.
- Error handling and edge cases.
- Testing performed.

Do not document hypothetical behavior.
Do not create duplicate documentation.
Do not modify source code just to add documentation.
Do not regenerate `docs/PROJECT_DOCUMENTATION.pdf` after every small change. Regenerate it when a consolidated documentation release is requested.

## README Maintenance — Mandatory

The root README.md is the primary technical assessment document for reviewers.

Whenever you implement, modify, refactor, or remove a feature, you MUST review and update README.md if the change affects the documented application.

### Update README.md when:
- A new feature is implemented.
- An existing feature's behavior changes.
- Application architecture or data flow changes.
- API integration or data handling changes.
- Business logic or important technical decisions change.
- A feature is removed or becomes incomplete.
- Testing or verification status changes.

### What to update:
1. Project overview, if affected.
2. Architecture diagram, if architecture changes.
3. Feature implementation table.
4. Technical decisions.
5. Assessment requirements coverage.
6. Testing and verification status.
7. Source-code references and file links.

### Rules:
- README.md must reflect the actual source code.
- Explain how features are implemented, not just what they do.
- Include relevant source file references.
- Never claim a feature is complete without verifying its implementation.
- Do not invent functionality, test results, or performance metrics.
- Preserve existing useful documentation.
- Keep the README concise and reviewer-focused.
- Do not rewrite the entire README for minor changes.
- Update only the relevant sections.
- Verify that links and source references are valid.

### Completion Requirement

Before finishing any implementation task:
1. Review the changes made.
2. Determine whether README.md needs updating.
3. Update README.md when relevant.
4. Verify that the README matches the current implementation.
5. Include README.md in the final change summary.

Never consider an implementation task fully documented until this review is completed.