---
name: clean-code
description: Simplicity and maintainability rules for this repo — avoiding over-engineering and premature abstraction, reusing installed libraries instead of hand-rolling, naming, function size, TypeScript type design, removing dead code, and where business logic belongs. Use when refactoring, simplifying, adding a new module or dependency, designing types, or reviewing a diff for unnecessary complexity.
---

# Clean code (MedEx)

The goal is the simplest maintainable code that keeps every assessment rule correct. Optimise for a reader who opens one file, not for fewer lines or more layers.

## Before adding anything, ask
1. Does the codebase already do this? Check `src/shared/`, the feature's `domain/`, and the installed libraries below.
2. Is there a second real use? If not, inline it instead of creating a helper, hook, type alias, wrapper or file.
3. Can a library already installed do it correctly?

## Reuse first (already installed)
| Need | Use |
|---|---|
| Server cache, polling, retries | `@tanstack/react-query` |
| Runtime validation of API data | `zod` |
| Accessible primitives | `radix-ui` via `src/components/ui/` (shadcn) |
| Icons | `lucide-react` |
| Class merging and variants | `cn()` from `@/lib/utils`, `class-variance-authority` |
| Routing and URL state | `react-router` and `URLSearchParams` |
| Money | `src/shared/lib/money.ts` (`Money`, `formatMoney`, `isCurrency`) |
| HTTP and errors | `apiRequest`, `ApiError`, `isOutcomeUnknown`, `describeApiError` |
| Time-zone math (mock) | `date-fns-tz` in `mock-api/`; the browser uses `Intl.DateTimeFormat` |

- Add a new dependency only for genuinely hard problems, and pin an exact version.
- Say why in `docs/ASSESSMENT_DECISIONS.md`. React Day Picker and React Hook Form were already evaluated and rejected; see `docs/CODEBASE_SIMPLIFICATION_AUDIT.md` §11.

## Structure
- Business rules (money, facets, cart, checkout, slots, time zones) live in pure `domain/` functions with no React and no fetch. UI calls them, and they are never duplicated in components.
- A feature has `api/`, `domain/`, `hooks/` and `components/`. Don't add folders for a single file.
- No barrel `index.ts` files and no re-export chains. Import from the defining module.
- Export only what another module uses; keep everything else file-private.

## Functions and naming
- Prefer small functions that each do one thing, with early returns instead of nested `if`/`else`.
- Names say intent: `isSlotPast`, `groupTotal`, `mergeGuestCart`. No `data2`, `tmp` or `handleStuff`. Booleans start with `is`, `has`, `can` or `should`.
- Name constants instead of using magic numbers (`MAX_QUANTITY = 20`, `BOOKING_WINDOW_DAYS = 90`).
- Comments explain why or a non-obvious rule, never what the next line does.

## TypeScript
- Model the domain with plain `type` objects and discriminated unions (`status: 'idle' | 'pending' | 'succeeded' | 'failed'`), not boolean flag soup.
- Avoid `any` and non-null `!` without a reason. Use `unknown` at boundaries and narrow it with Zod.
- Infer API types from Zod schemas (`z.infer`) instead of writing them twice.
- Use no generics unless two or more concrete types actually flow through. Never use type gymnastics for convenience.

## Removing code
- Delete unused code, exports, files and dependencies. Git keeps history, so don't comment code out.
- When simplifying, keep behaviour identical and keep the tests unchanged.
- Never weaken or delete a test to make a refactor pass.

## Review checklist for a diff
- [ ] Is there a new abstraction with only one caller? Inline it.
- [ ] Did hand-rolled logic duplicate a library or an existing helper?
- [ ] Is any business rule outside `domain/`, or duplicated?
- [ ] Are there new exports nobody imports?
- [ ] Did any correctness rule from `CLAUDE.md` get simplified away?
