---
name: frontend-design
description: MedEx UI/UX and visual design rules — light-theme design tokens, Tailwind CSS 4 utilities, shadcn/ui and Lucide usage, layout, responsive behaviour, loading/empty/error states and accessibility. Use when creating or restyling pages, components, dialogs, drawers, forms, cards, buttons, colours, spacing or icons in src/, or when reviewing how the app looks or feels.
---

# Frontend design (MedEx)

The look should be a bright, calm healthcare marketplace, not an admin dashboard.

## Tokens, never ad-hoc values
- Colours come from tokens in `src/index.css`. Use `bg-background`, `bg-surface` (lavender sections), `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-primary`/`text-primary-foreground`, `bg-secondary`, `bg-accent`, `border-border`, `ring-ring`, `text-destructive`/`bg-destructive-soft`, `text-success`/`bg-success-soft`, `bg-warning-soft`/`text-warning-foreground`, `bg-discount`, `text-star`, and `brand-purple`/`brand-magenta`/`brand-teal`.
- No hex, `rgb()` or Tailwind palette colours (`bg-purple-700`) in components. If a colour is missing, add a token to `src/index.css` (both the `:root` variable and the `@theme` mapping).
- Teal is for non-text highlights only; use `brand-teal-text`/`success` when teal text is needed.
- Never use `dark:` variants or a theme toggle.
- Radius comes from `--radius` (`rounded-md`/`rounded-lg`). Card shadows use `shadow-card`. Keep cards white with a subtle border.

## Components
1. Use a shadcn primitive from `src/components/ui/` first. If one is missing, run `npx shadcn@4.21.4 add <name>`, then make it import `cn` from `@/lib/utils` and remove any `cn` npm package the CLI added.
2. Use the app-level pieces in `src/shared/ui/`: `PageContainer`, `EmptyState`, `ErrorState`, `OfflineBanner`, `NativeSelect`, `ServiceTypeIcon`, `RefreshButton` (above a page's list; pass the page's query key prefix).
3. Icons come from `lucide-react`. Decorative icons get `aria-hidden`; icon-only buttons need an `aria-label`.
4. There is no toast library; status and errors stay inline next to the thing they're about (live regions announce them).
5. Compose classes with `cn()`. Use `cva` only where a component genuinely has variants.
- Don't create a component for a one-off `<div>` with classes. Extract one only when the markup repeats or the parent gets hard to read.

## Layout and hierarchy
- Mobile first. Everything must work at 360 px with no horizontal scroll, then enhance with `sm:`/`md:`/`lg:`.
- Show one primary action per view (purple `Button`), with secondary actions as `variant="outline"` or `ghost`.
- Prices: the final price is prominent, a struck-through original is `text-muted-foreground`, and a discount badge uses `bg-discount`. Always show the currency, and never place two currencies in one total.
- Times in booking: the provider time is primary, and the customer time sits beside it with a next/previous-day marker.
- Keep spacing consistent with the existing scale (`gap-2/3/4/6`, `p-4/6`), and don't introduce arbitrary values (`mt-[13px]`).

## Every async view has explicit states
Plan for these states: loading (a skeleton shaped like the content), slow (`useDelayedFlag`), empty (`EmptyState`, with a way out), error (`ErrorState` with retry, worded via `describeApiError`), offline (`OfflineBanner`), and conflict or unknown outcome where writes happen.

## Accessibility (non-negotiable)
- Use semantic elements (`button`, `nav`, `main`, headings in order, `section` with an accessible name) and native controls where possible.
- Every input has a `<Label>`. Validation messages are linked with `aria-describedby`.
- Focus must be visible and in a logical order. Dialogs and sheets return focus on close, and moving focus to new results or status is deliberate.
- Announce async results and errors with `role="status"` or `role="alert"`.
- Never use colour alone for status; pair it with text or an icon. Keep text contrast at AA or better.
- Animations come from `tw-animate-css` and respect `motion-reduce:`.

## Verify
1. Run `npm run dev` and check the changed page at desktop (~1280 px) and mobile (~375 px) widths, including its loading state (every API response takes 1.5 s). Error states are covered by tests (`failNext`).
2. Check keyboard-only navigation through the changed flow.
3. `grep -rn "dark:\|#[0-9a-fA-F]\{6\}" src --include=*.tsx` should find nothing new outside `src/index.css`.
