# Prompt 00 — Audit the Existing Repository (READ ONLY)

You are the senior frontend engineer responsible for this MedEx assessment. **Do not assume Task 1 exists. All three tasks may be completely new.** Determine the actual state by inspecting the repository.

## Read first
- `CLAUDE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/CODING_STANDARDS.md`
- All PDFs under `assessment-briefs/`
- All corresponding JSON fixtures under `data/`
- `package.json`, source tree, tests, `.gitignore`, and Git status
- `mock-api/README.md` and `mock-api/server.cjs`

## Your work
1. Identify framework, routing, styling, state management, API strategy, tests, lint/typecheck/build scripts.
2. For each task, classify it as **absent / partial / implemented**, with concrete file and line evidence.
3. Inspect the full Task 1 fixture and brief; identify data relationships, visibility, filters, facets, price formula, currencies, duplicate `ultrasound` category slugs, URL state and 3,200-record performance considerations.
4. Inspect every Task 2 cart group, line item, catalog item and guest cart item. Identify overlaps, missing products, empty products and wellness selections.
5. Inspect Task 3 providers, timezone strings, schedules, specialists, closures, booked slots and existing booking.
6. Verify that the provided `mock-api/` starts and that its routes match its README. Do not silently change the contract during this audit.
7. Identify missing project hygiene: `.gitignore`, TypeScript/lint conventions, tests, environment handling and README.
8. Create `docs/EXISTING_REPO_AUDIT.md` with current stack, task status/evidence, risks, proposed files, dependency changes and phased test plan.

## Constraints
- READ ONLY: do not edit application source, package files, fixtures or configuration.
- You may create only `docs/EXISTING_REPO_AUDIT.md` as the audit deliverable.
- Do not reorganize a working repository for aesthetic reasons.
- Stop after the audit and present the implementation plan for approval.
