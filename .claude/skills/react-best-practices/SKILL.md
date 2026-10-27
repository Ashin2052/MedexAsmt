---
name: react-best-practices
description: React 19 + TanStack Query + React Router patterns for this codebase — when (not) to use useEffect, useMemo, useCallback, useRef and custom hooks, where state lives (local, URL, server cache, module store), data fetching/mutations, and component splitting. Use when writing or refactoring components or hooks in src/, adding data fetching or mutations, or reviewing React code for unnecessary complexity.
---

# React best practices (MedEx)

## Where state lives
| Kind | Put it in | Example here |
|---|---|---|
| Server data | TanStack Query (`useQuery` / `useMutation`) | explorer index, cart, slots |
| Shareable view state (filters, sort, page, selection) | URL search params via React Router | `useExplorerUrlState`, booking selection |
| Local UI state (open, input text) | `useState` in the component that owns it | drawers, inputs |
| Persisted, multi-component state outside React | small module store + `useSyncExternalStore` | checkout records in `useCheckout.ts`, `useOnlineStatus` |

- No Context, Redux or Zustand unless state is truly app-wide and the URL or Query can't hold it.
- Don't copy props or query data into state. Derive values during render.

## Hooks: default to none
- **`useEffect`** is only for syncing with something outside React: storage, focus, subscriptions, timers. It is never for computing values or reacting to your own state changes; do that in the event handler or during render.
- **`useMemo`** only for measured-expensive work. In this codebase that means the 3,200-service facet and grouping engine, plus slot and alternative lists. Never for slices, filters of small arrays, or object literals.
- **`useCallback`** only when identity matters: an effect dependency, or a prop of a memoised child. Otherwise use a plain function.
- **`useRef`** for DOM nodes or request bookkeeping that must not re-render (an in-flight flag, a last attempt). Never as a hidden copy of state.
- **Custom hooks:** extract one only when it is reused, or when it hides real stateful logic like `useQuantityQueue` or `useCheckout`. A wrapper around a single `useQuery` used once should be inlined.

## Data fetching
- Each `queryFn` calls a feature `api/` function (`apiRequest` plus a Zod schema). Components never call `fetch`.
- Query keys are arrays starting with the feature name; invalidate or update exactly the keys a mutation affects.
- Polling uses `refetchInterval`, not hand-written timers. Retries and backoff use Query options.
- Writes that can be lost in transit use an idempotency key (`crypto.randomUUID()`), persisted before sending when the brief requires it. Treat `isOutcomeUnknown(error)` as "check again", not as a failure.
- Guard double submits by disabling while pending and ignoring repeats. Ignore stale responses by keying on the request.

## Components
- Components are function components with named exports. Keep feature components in `features/<f>/components/`, and give a component props only for what it renders.
- Split a component when a block has its own state or is reused, or when the parent exceeds about 250 lines and has clear sections. Don't split purely to cut line counts.
- Use stable `key`s from IDs, never array indexes for data rows.
- Never mutate props, query data or fixtures; return new objects.
- Event handler names say what happens (`removeLine`), not `handleClick2`.

## Routing
- Routes are defined in `src/app/App.tsx`, and pages are lazy-loaded.
- Use `<Link>` or `useNavigate` for navigation; reading or writing filter state goes through the feature's URL-state helper.
- Back and forward must restore the view, so push history for user navigation and replace it for normalisation.

## Before finishing
Run `npm run lint`; `react/rules-of-hooks` is an error. Re-check each new hook against the rules above.
