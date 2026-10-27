# Prompt 05 — Final Assessment Review

Act as a skeptical MedEx senior frontend reviewer. Read all three assessment briefs and the implementation. Do not make speculative changes before reporting findings.

## Review areas
1. Correctness against every requirement in all three PDFs.
2. Task 1 implementation and regression: filters, facets, duplicate slugs, currency logic, URL state, price formula, performance.
3. Task 2: optimistic quantity concurrency, wellness price selection, unavailable item, guest merge, currency subtotals, partial checkout, idempotency, reload reconciliation.
4. Task 3: timezone formats/fallback, provider-local dates, slot cadence, provider opening-hour overlap, group consecutive slots, today cutoff, two-clock clarity, 409 and reschedule.
5. Mock API boundaries, realistic latency, deterministic failure injection, error types.
6. Accessibility, responsive behavior, loading/empty/error/offline/conflict states.
7. Type quality, maintainability, performance, unnecessary dependencies, and security basics.
8. README accuracy and AI usage disclosure.

## Process
- Inspect Git diff and run the actual scripts from `package.json`.
- Run all unit/integration tests and production build.
- Use specialist review subagents for Task 1, Task 2, and Task 3 if useful. Ask them for findings only; avoid parallel edits.
- Classify findings as Blocker / High / Medium / Low and cite file paths/line numbers.
- Fix Blocker and High findings only when safe and within time. Add tests for fixes.
- Do not claim success for commands you did not run.
- Do not refactor working code solely for style.

## Output
Create/update:
- `docs/FINAL_REVIEW.md` — acceptance matrix, findings, tests actually run, remaining risks.
- `README.md` — setup/run instructions, feature overview, architecture, decisions/trade-offs, known data issues, AI assistance, incomplete work/next steps.

End with a concise submission checklist and a 3–5 minute demo script.
