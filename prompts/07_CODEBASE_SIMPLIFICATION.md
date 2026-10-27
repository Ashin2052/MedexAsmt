# MedEx — Codebase Simplification and Clean React Refactoring

Act as a Senior React Architect and experienced Frontend Engineer.

The current codebase has become unnecessarily complicated. There are too many abstractions, excessive TypeScript types, complicated API/mock server implementations, unnecessary React refs, excessive custom hooks, and code that could be much simpler.

Your responsibility is to simplify the entire codebase while preserving all assessment requirements and functionality.

**Core principle: Write the simplest maintainable solution that correctly solves the problem.**

Do not confuse complex architecture with good engineering.

---

## 1. First: Audit the Entire Codebase

Before modifying anything, inspect:

- package.json
- src/
- components/
- hooks/
- services/
- API clients
- state management
- mock-api/
- vite.config.ts
- TypeScript configuration
- CSS and Tailwind configuration
- Existing tests

Identify:

1. Unnecessary abstractions.
2. Duplicated code.
3. Over-engineered API layers.
4. Excessive custom hooks.
5. Unnecessary useRef and useMemo.
6. Unnecessary useCallback.
7. Excessive TypeScript generics and interfaces.
8. Unnecessary state management.
9. Complicated JSON Server configuration.
10. Unnecessary dependencies.
11. Components that are too large.
12. Components that are unnecessarily split into multiple files.

Create `docs/CODEBASE_SIMPLIFICATION_AUDIT.md`.

Do not start rewriting everything before completing the audit.

---

## 2. React Architecture — Keep It Simple

Follow practical React principles.

### Components

- Prefer functional components.
- Keep components small and focused.
- Separate UI from business logic when it improves clarity.
- Avoid unnecessary component nesting.
- Avoid creating components for trivial one-line elements.
- Avoid giant components containing the entire application.
- Reuse components when there is genuine repetition.

### React Hooks

Use hooks only when necessary.

Avoid unnecessary:
- useRef
- useMemo
- useCallback
- useEffect
- Custom hooks

Rules:

- Do not use useEffect for calculations that can happen during rendering.
- Do not use useEffect to synchronize state unnecessarily.
- Do not use useRef as a replacement for normal state.
- Do not wrap every function in useCallback.
- Do not memoize everything.
- Use useMemo only when there is a meaningful performance reason.
- Use useCallback only when referential stability is actually needed.

### State Management

Prefer the simplest suitable solution.

- Local component state for local UI.
- Lift state only when multiple components need it.
- Use Context only for genuinely shared application state.
- Use URL search parameters for shareable/filterable page state.
- Avoid Redux or Zustand unless there is a demonstrated requirement.

Do not introduce a global state library just for the sake of architecture.

---

## 3. API and JSON Server — Simplify Aggressively

The mock API implementation should not be more complicated than the application itself.

Review the existing JSON Server setup.

Prefer:

- Standard JSON Server functionality.
- Simple routes.
- A small number of clear API functions.
- Straightforward request/response handling.
- One reusable API client if needed.

Avoid:

- Unnecessary middleware.
- Multiple API abstraction layers.
- Custom routing frameworks.
- Complicated proxy configurations.
- Excessive request wrappers.
- Duplicate error-handling layers.
- Unnecessary backend-style architecture for static assessment JSON.

Do not build a custom backend when JSON Server already handles the requirement.

Use custom routes only when the assessment genuinely requires behavior that standard JSON Server cannot provide.

Keep the frontend API integration simple and readable.

Example preferred structure:

src/
  lib/
    api.ts
  features/
    services/
      services.api.ts
    cart/
      cart.api.ts
    booking/
      booking.api.ts

Do not create all these files if the project does not need them.

---

## 4. TypeScript — Practical, Not Excessive

Use TypeScript to improve safety, not to make simple code difficult to understand.

- Define interfaces for actual domain models.
- Reuse shared types where appropriate.
- Avoid deeply nested generic types without a clear benefit.
- Avoid unnecessary type wrappers.
- Avoid excessive type assertions.
- Avoid `any` where proper types are straightforward.
- Avoid duplicating types already provided by libraries.

Prefer readable types over clever types.

---

## 5. Use Libraries for Complicated Problems

Do not manually implement complex functionality when a mature, reliable library already solves the problem.

Evaluate existing dependencies first.

Potential choices:

| Problem | Recommended library |
|---|---|
| Date and timezone calculations | date-fns + date-fns-tz or Luxon |
| Form management | React Hook Form |
| Validation | Zod |
| Accessible UI components | shadcn/ui / Radix UI |
| Icons | Lucide React |
| URL state | React Router or native URLSearchParams |
| Complex tables | TanStack Table, only if needed |
| Server data fetching/cache | TanStack Query, if justified |
| Calendar UI | React Day Picker |
| Notifications | Sonner |

Important:

- Check compatibility with the current project.
- Reuse existing libraries where possible.
- Do not install every library listed above.
- Do not use a library for trivial logic.
- Keep dependencies minimal.

---

## 6. Business Logic — Preserve Correctness

Simplification must not remove important assessment requirements.

Preserve and test:

### Service Explorer
- Exact pricing calculation.
- Discounts and wellness pricing.
- Currency handling.
- Filters and facets.
- Search and sorting.
- URL-persisted state.
- Browser back/forward behavior.
- Duplicate category slug handling.

### Cart and Checkout
- Product final-price handling.
- Unpriced wellness items.
- Unavailable products.
- Optimistic quantity updates.
- Per-line update serialization.
- Split checkout.
- Currency separation.
- Idempotency.
- Reload reconciliation.
- Partial checkout success/failure.

### Booking
- Timezone conversion.
- Country-based timezone fallback.
- Provider-local calendar dates.
- Slot duration and buffer.
- Consecutive slot requirements.
- Availability intersection.
- Today's booking cutoff.
- Customer/provider time display.
- 90-day booking window.
- Booking conflicts.
- Rescheduling.

Do not simplify away these requirements.

---

## 7. Clean Code Standards

Follow these rules:

- Meaningful variable and function names.
- Small, readable functions.
- Avoid deeply nested conditionals.
- Use early returns where appropriate.
- Avoid duplicated business logic.
- Avoid unnecessary comments.
- Remove dead code.
- Remove unused imports.
- Avoid magic numbers.
- Keep error handling understandable.
- Prefer straightforward control flow.
- Avoid unnecessary design patterns.
- Avoid premature optimization.

A new developer should be able to understand the code without navigating through ten files for one simple operation.

---

## 8. CSS and UI Architecture

Keep the existing MedEx light-theme design.

- Use Tailwind CSS for most styling.
- Use shadcn/ui for standard accessible components.
- Keep global CSS minimal.
- Remove redundant styles safely.
- Avoid duplicated utility combinations where a reusable component is justified.
- Do not introduce CSS abstractions for one-off styles.
- Keep responsive behavior intact.

Preserve the existing purple/magenta MedEx branding and white/light backgrounds.

---

## 9. File Structure

Prefer a simple feature-oriented structure.

Example:

src/
  components/
    ui/
    layout/
  features/
    services/
      ServiceExplorer.tsx
      ServiceCard.tsx
      services.api.ts
      services.types.ts
    cart/
      Cart.tsx
      CartItem.tsx
      cart.api.ts
      cart.types.ts
    booking/
      Booking.tsx
      booking.api.ts
      booking.types.ts
  lib/
    api.ts
    utils.ts
  App.tsx
  main.tsx

This is a guideline, not a mandatory structure.

Do not create empty folders or files just to follow this example.

Avoid unnecessary index.ts barrel files and excessive re-export chains.

---

## 10. Refactoring Workflow

Work incrementally.

### Phase 1 — Audit
Inspect the codebase and report unnecessary complexity.

### Phase 2 — Simplification plan
List:
- What should be removed.
- What should be merged.
- What should be retained.
- Which libraries should replace custom implementations.
- Which areas are risky to change.

### Phase 3 — Refactor
Simplify one feature at a time.

Do not rewrite the entire application in one operation.

### Phase 4 — Verification
After each feature:

- Run TypeScript checks.
- Run lint.
- Run relevant tests.
- Run production build.
- Verify actual functionality.

### Phase 5 — Final review
Report:
- Files removed.
- Files merged.
- Dependencies removed/added.
- Custom logic replaced with libraries.
- Complexity reduced.
- Assessment requirements verified.
- Remaining technical debt.

---

## FINAL ENGINEERING PRINCIPLE

Do not optimize for the number of files, lines of code, hooks, interfaces or abstractions.

Optimize for:

1. Correctness.
2. Readability.
3. Maintainability.
4. Simplicity.
5. Performance where it matters.
6. Assessment compliance.

**If a problem can be solved clearly in 15 lines, do not build a 100-line abstraction around it.**

Do not sacrifice critical business logic for fewer lines of code.

Start with the audit and wait for approval before performing large-scale refactoring.