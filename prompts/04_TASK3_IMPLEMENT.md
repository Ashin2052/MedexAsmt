# Prompt 04 — Implement Task 3: Appointment Booking Across Time Zones

You are implementing Task 3 in the MedEx assessment. Read the complete `assessment-briefs/task3_booking_time_zones.pdf` and inspect the complete `data/task3-booking.json` before coding. Follow `CLAUDE.md` and use the `/timezone-booking` skill.

## First: inspect and plan
Inspect every provider, timezone string, opening-hours schedule, specialist consultation schedule, closure, booked slot, and `existingBooking`. Produce a table of raw timezone values and the normalized result/fallback before writing the implementation. Identify edge cases in the actual data. Then list exact files and tests.

## Core domain logic (keep pure and tested)
1. Normalize timezone values after trimming whitespace. Handle IANA names, `UTC+05:45`-style offsets, `(GMT+5:45)`-style values, `Nepal Standard Time`, and the supplied `Asia/Katmandu` alias. Validate normalized values with `Intl.DateTimeFormat` or the chosen timezone library.
2. If a timezone cannot be understood, fall back by provider country: TH → `Asia/Bangkok`, NP → `Asia/Kathmandu`, IN → `Asia/Kolkata`. Document the mapping and invalid originals.
3. Convert `dayOffset` into a real calendar date relative to today's date at that provider. Do this when the mock API initializes; do not use the customer's browser calendar date.
4. Booking window is 90 days.
5. Generate slots from `consultation.startTime` at an interval of `durationInMinutes + bufferInMinutes`. The slot must end by consultation end time.
6. Intersect specialist consultation hours with provider opening hours. A slot is offered only when the full appointment duration is inside provider opening hours. Explain reduced availability in the UI.
7. Booked slots remain visible but disabled.
8. For today, disable any slot whose start time has already passed according to the provider's clock.
9. For N people (1–4), only offer a start time if N consecutive free slots exist for the same specialist. Respect the duration+buffer interval and do not count booked slots.
10. Show provider local time and the customer's local time beside each available slot with explicit labels. Detect the customer's browser timezone; do not assume it is Kathmandu for every user. Make the demo default/documented timezone clear if a test override is provided.

## UI and flows
- 90-day calendar; past, weekly-closed, closure, and no-available-slot days must be visibly unavailable with a reason.
- Specialist selector narrows availability.
- Slots are grouped (morning / afternoon / evening) and booked slots are visible but not selectable.
- Group size selector supports 1–4 and recalculates valid start times.
- Booking confirmation clearly shows provider, specialist, date, group size, provider-local time, and customer-local time.
- Reschedule starts from `existingBooking`; show old appointment versus proposed new appointment unmistakably before confirmation.
- If POST/PUT returns 409, retain provider, specialist, date, group size, and selections; explain that the slot was taken and show the closest alternatives.
- API failure can be retried without losing selection. Slow/offline states are visible; never allow a second confirmation while the first request has unknown outcome.
- Add a small development control or query flags for latency, 500/network error, and on-demand 409.
- Calendar and slot grid must be keyboard usable with sensible arrow-key behavior and screen-reader labels.

## Suggested mock API contract
- `GET /api/task3/providers/:id`
- `GET /api/task3/providers/:id/slots?date=YYYY-MM-DD&specialistId=...&people=N`
- `POST /api/task3/bookings`
- `PUT /api/task3/bookings/:bookingId`

Keep timezone normalization, date offset conversion, slot generation, availability, and alternatives in pure functions. Keep the HTTP handler thin.

## Tests to add
- all raw timezone formats found in the fixture normalize or use the documented country fallback;
- offset and IANA timezone conversion;
- dayOffset computed from provider-local today;
- missing weekly schedule means closed;
- consultation hours partly outside provider hours are intersected correctly;
- duration + buffer slot cadence and final slot end boundary;
- booked slots disabled;
- provider-local today cutoff;
- N consecutive free slots for group sizes 1–4, including a booked slot breaking the sequence;
- nearest alternative ordering after 409;
- reschedule does not accidentally offer the old booking as occupied by itself.

## Finish
Run tests, lint, typecheck, and build. Update README and `docs/ASSESSMENT_DECISIONS.md` with timezone mapping, assumptions, and limitations. Give me a manual scenario for Kathmandu user booking at the Bangkok hospital and one scenario that triggers 409.
