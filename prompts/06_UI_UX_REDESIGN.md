# MedEx — UI/UX Redesign

Act as a Senior Product Designer and Senior React Frontend Engineer.

Redesign the existing MedEx assessment application using the attached MedEx website screenshot as the primary visual reference.

## 1. Design identity

Create a professional healthcare marketplace inspired by the reference.

Use:
- Primary: deep MedEx purple.
- Secondary: violet and magenta.
- Accent: teal/turquoise.
- Background: light neutral grey.
- Cards: white with subtle borders.
- Typography: Inter.
- Icons: Lucide React.

The result should feel like a modern healthcare booking platform, not a generic admin dashboard.

## 2. Technology

Use:
- React + TypeScript + Vite (existing stack).
- Tailwind CSS for almost all styling.
- shadcn/ui for reusable accessible components.
- Lucide React for icons.
- Motion only for subtle transitions when genuinely useful.

Inspect existing dependencies before installing anything.

Use compatible library versions. Do not blindly replace existing dependencies.

## 3. Reduce CSS complexity

This is a major requirement.

- Move most component styling to Tailwind utility classes.
- Remove duplicated and obsolete CSS after verifying it is unused.
- Centralize colours, typography and design tokens.
- Avoid large component-specific stylesheets.
- Avoid inline style objects.
- Avoid excessive arbitrary Tailwind values.
- Avoid unnecessary !important declarations.
- Use reusable components instead of repeating long UI structures.
- Keep global CSS minimal.

Do not blindly delete CSS files or break existing styles.

## 4. Shared UI components

Create a consistent component system:

- Application header/navigation.
- Page container.
- Search input.
- Buttons.
- Service cards.
- Provider cards.
- Price display.
- Discount badges.
- Filter sidebar.
- Mobile filter drawer.
- Dialogs.
- Dropdowns.
- Tabs.
- Date picker.
- Time slot selector.
- Cart summary.
- Checkout status.
- Toast notifications.
- Loading skeletons.
- Empty and error states.

Use shadcn/ui where appropriate rather than rebuilding standard components.

## 5. Task-specific design

### Service Explorer
Make service discovery visually appealing:
- Search prominently displayed.
- Category navigation.
- Professional service cards.
- Clear provider details.
- Original and discounted pricing.
- Filters that are easy to understand.
- Responsive grid.
- Mobile filter drawer.

### Cart and Split Checkout
- Clear provider grouping.
- Professional cart items.
- Easy quantity controls.
- Separate order summaries.
- Clear currency labels.
- Unavailable/unpriced product warnings.
- Clear checkout actions and results.

### Booking
- Clean booking flow.
- Provider details.
- Date navigation.
- Modern calendar.
- Attractive time-slot buttons.
- Clear unavailable and selected states.
- Provider and customer timezone labels.
- Confirmation and conflict handling.

## 6. Responsive requirements

Test:
- 375px mobile.
- 430px mobile.
- 768px tablet.
- 1280px desktop.
- 1440px desktop.

No horizontal overflow, clipped content or broken layouts.

## 7. Preserve functionality

This is a technical assessment.

Do not modify:
- Pricing calculations.
- API contracts.
- Cart business rules.
- Checkout idempotency.
- Booking timezone logic.
- Slot availability rules.
- URL state behaviour.

UI changes must not compromise assessment requirements.

## 8. Implementation workflow

1. Inspect existing application and dependencies.
2. Inspect the existing CSS architecture.
3. Propose the Tailwind and shadcn/ui integration plan.
4. Implement the shared design system.
5. Redesign Service Explorer.
6. Redesign Cart and Checkout.
7. Redesign Booking.
8. Remove redundant CSS safely.
9. Test responsive layouts.
10. Run tests, lint and production build.

Do not stop after proposing a design. Implement it in the existing application.

After implementation, report:
- Dependencies added.
- Components created or redesigned.
- CSS removed or consolidated.
- Functionality preserved.
- Responsive testing results.
- Remaining issues.