# Prompt 02 — Task 1: Implement Service Explorer from Scratch

Task 1 is a **new implementation** unless the repository audit (`docs/EXISTING_REPO_AUDIT.md`) proves that a usable implementation already exists. Do not treat this prompt as regression-only. If Task 1 is absent, build it from scratch. If partial, implement missing acceptance criteria. Preserve only code that is genuinely working and relevant.

## Mandatory source files
Read the complete:
- `assessment-briefs/task1_service_explorer.pdf`
- `data/task1-service-explorer.json`
- `CLAUDE.md`
- `docs/CODING_STANDARDS.md`
- `docs/MOCK_API_CONTRACTS.md` if present; otherwise inspect `mock-api/README.md` and `mock-api/server.cjs`.

Treat the PDF and fixture as source of truth. Inspect the entire dataset, not excerpts.

## Phase 1 — Requirements and data analysis
Before coding, create `docs/TASK1_REQUIREMENTS.md` containing functional requirements, data relationships, exact business rules, API needs, UI states, edge cases, ambiguities and a requirement-to-test matrix. Identify duplicate identifiers/slugs and nullable or malformed data.

## Phase 2 — API integration
Use the provided JSON Server replication API at `http://localhost:4010`:
- `GET /api/explorer/categories`
- `GET /api/explorer/providers`
- `GET /api/explorer/services`

Use the existing API conventions from the server implementation. Frontend components must not import the fixture directly. Implement typed API access, loading/error/retry states, cancellation where useful, and query parameter support. If an endpoint truly needs extending, update the mock API and its README/tests; do not bypass it with direct JSON imports.

## Phase 3 — Functional implementation
Implement every requirement in the Task 1 PDF, including:
- Provider-grouped results, maximum three preview services, correct filtered counts and expansion.
- Every required filter and free-text search.
- Live facet counts excluding the facet currently counted while applying all other filters.
- Zero-result options with disabled/unavailable behavior documented.
- Service/provider/category visibility rules.
- Exact final-price formula and discount display; wellness option prices displayed distinctly.
- Currency-specific price filtering for THB/NPR/INR without FX conversion or cross-currency totals.
- All required sort modes.
- URL-persisted search/filters/sort/page, direct links, reload, back and forward.
- Responsive mobile filter drawer with pending result count, apply/clear behavior.
- Loading skeleton, empty, error and retry states.
- Semantic keyboard and screen-reader accessibility.

## Critical data and calculation rules
- Dataset contains 3,200 services; plan and measure performance on the full dataset.
- Two top-level `ultrasound` categories exist across service types. Distinguish by category ID and/or type + ID, never slug alone.
- Apply the exact discount/service-charge formula from the brief.
- Do not round intermediate money calculations; round/format only for display as specified.
- Wellness does not have a conventional base price; never fabricate one.
- Never compare or total amounts across currencies.
- Visibility: service status `true`, provider status `active`, category status `true` when category exists.

## Phase 4 — Tests and performance
Add focused unit/integration tests for provider grouping, preview limits/counts, search, every filter, disjunctive facet counts, zero-result choices, visibility, duplicate slugs, exact price math, wellness, currency isolation, sort, URL restore/history, mobile drawer, loading/error/retry and accessibility-critical interactions.

Measure full-dataset responsiveness with a reproducible method. Record device/browser, dataset size, warm-up, number of runs, measurement boundaries and actual results. **Never claim a 100 ms target without evidence.**

## Phase 5 — Documentation and finish
Update `docs/TASK1_REQUIREMENTS.md`, `docs/ASSESSMENT_DECISIONS.md` and root `README.md`. List implemented criteria, incomplete criteria, assumptions, commands, actual test results and performance measurements.

## Execution rules
Analyze first; provide a file-by-file plan and test matrix; then implement in vertical slices. Follow coding standards. Do not stop at a static UI mockup: the feature must call the mock API and work end-to-end. Do not refactor unrelated code.
