# Prompt 01 — Minimal Architecture, JSON Server and Project Standards

Read `docs/EXISTING_REPO_AUDIT.md`, `CLAUDE.md`, `docs/REPO_STRUCTURE.md`, `docs/CODING_STANDARDS.md`, and `mock-api/README.md`.

## Objective
Prepare the existing frontend repository for all three new/partial tasks. The supplied `mock-api/` is the replication server; do not replace it with a different backend or move fixture data.

## Requirements
1. Retain current framework, router, styling, state/query tools and test setup unless audit proves a blocker.
2. Ensure `.gitignore` exists and is appropriate for the actual stack. Start from kit `.gitignore`, then merge rather than blindly overwriting existing rules.
3. Apply coding standards from `docs/CODING_STANDARDS.md`; document any repository-specific variation.
4. Configure a frontend environment variable for API base URL, defaulting locally to `http://localhost:4010` (for example `NEXT_PUBLIC_API_BASE_URL` only if Next.js is used).
5. Start and verify the supplied mock API independently. It reads fixture files from `../data/`; keep those canonical files in the root `data/` directory.
6. Build a typed API boundary; UI components must not import fixture JSON.
7. Add only justified dependencies and explain each before installing.
8. Do not build Task 1/2/3 UI in this phase unless needed to prove API connectivity.

## Workflow
- State exact files to create/change.
- Preserve uncommitted user work.
- Verify API health and representative endpoints with curl or tests.
- Run existing lint/typecheck/tests/build commands where available.
- Update `docs/ASSESSMENT_DECISIONS.md` and README with verified setup.
- Summarize actual checks and remaining work.
