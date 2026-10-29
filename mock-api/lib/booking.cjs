'use strict';
// Task 3 mock rules as plain functions over an explicit state object, so the
// route handlers in server.cjs stay thin and every rule is unit-tested
// (mock-api/lib/booking.test.mjs). All "now" values are injectable.

const crypto = require('node:crypto');
const { formatInTimeZone, fromZonedTime, getTimezoneOffset } = require('date-fns-tz');

const BOOKING_WINDOW_DAYS = 90;
const MAX_PEOPLE = 4;
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// ---------------------------------------------------------------- time zones

const COUNTRY_FALLBACK = { TH: 'Asia/Bangkok', NP: 'Asia/Kathmandu', IN: 'Asia/Kolkata' };
/** Legacy IANA aliases → current canonical names. */
const IANA_ALIASES = { 'Asia/Katmandu': 'Asia/Kathmandu', 'Asia/Calcutta': 'Asia/Kolkata' };
/** Windows time zone names that appear (or plausibly appear) in provider data. */
const WINDOWS_ZONES = {
  'nepal standard time': 'Asia/Kathmandu',
  'india standard time': 'Asia/Kolkata',
  'se asia standard time': 'Asia/Bangkok',
};
/** Offsets we can map to a real zone for the markets MedEx serves (minutes east of UTC). */
const OFFSET_ZONES = { 345: 'Asia/Kathmandu', 330: 'Asia/Kolkata', 420: 'Asia/Bangkok' };

/** Minutes east of UTC for `zone` at `now` (NaN for an unknown zone). */
function zoneOffsetMinutes(zone, now) {
  return getTimezoneOffset(zone, new Date(now)) / 60000;
}

function isValidZone(zone) {
  return !Number.isNaN(zoneOffsetMinutes(zone, Date.now()));
}

/** "UTC+05:45", "(GMT+5:45)", "UTC+0545", "GMT-3" → minutes east of UTC, or null. */
function parseOffset(text) {
  const match = /^\(?\s*(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?\s*\)?$/i.exec(text);
  if (!match) return null;
  const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
  if (Number(match[2]) > 14 || Number(match[3] || 0) >= 60) return null;
  return match[1] === '-' ? -minutes : minutes;
}

/**
 * Turn the provider's free-text timezone into a valid IANA zone.
 * Order: trim → legacy alias → valid IANA → Windows name → UTC/GMT offset
 * (matched to the country's zone, or a known zone with that offset) →
 * country fallback. `source` and `note` explain the decision to customers.
 */
function normalizeTimezone(raw, country, now = Date.now()) {
  const original = raw == null ? '' : String(raw);
  const trimmed = original.trim();
  const fallback = COUNTRY_FALLBACK[country] || 'UTC';
  const result = (zone, source, note = null) => ({ raw: original, zone, source, note });

  if (trimmed) {
    if (IANA_ALIASES[trimmed]) return result(IANA_ALIASES[trimmed], 'alias');
    if (trimmed.includes('/') && isValidZone(trimmed)) return result(trimmed, 'iana');
    const windows = WINDOWS_ZONES[trimmed.toLowerCase()];
    if (windows) return result(windows, 'windows');
    const offset = parseOffset(trimmed);
    if (offset !== null) {
      if (zoneOffsetMinutes(fallback, now) === offset) return result(fallback, 'offset');
      if (OFFSET_ZONES[offset]) {
        return result(OFFSET_ZONES[offset], 'offset', `Offset ${trimmed} does not match the provider's country; using ${OFFSET_ZONES[offset]}.`);
      }
    }
  }
  return result(
    fallback,
    'country-fallback',
    trimmed
      ? `The provider's time zone "${trimmed}" isn't recognised, so we use ${fallback} (${country}).`
      : `The provider hasn't set a time zone, so we use ${fallback} (${country}).`,
  );
}

// ------------------------------------------------------- dates and clocks

function isDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

function weekdayName(date) {
  return DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

function toMinutes(clock) {
  const [h, m] = String(clock).split(':').map(Number);
  return h * 60 + m;
}

function toClock(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** The provider's calendar date and minutes-past-midnight at `now`. */
function zonedNow(zone, now = Date.now()) {
  return {
    date: formatInTimeZone(new Date(now), zone, 'yyyy-MM-dd'),
    minutes: toMinutes(formatInTimeZone(new Date(now), zone, 'HH:mm')),
  };
}

/** UTC instant (ms) of a wall-clock time in `zone`. */
function zonedTimeToUtc(date, clock, zone) {
  return fromZonedTime(`${date} ${clock}`, zone).getTime();
}

// ------------------------------------------------------------------ state

function bookedKey(providerId, specialistId, date, startTime) {
  return `${providerId}|${specialistId}|${date}|${startTime}`;
}

/**
 * Build mock state. Every dayOffset becomes a real date relative to "today at
 * that provider" when the mock starts (brief), so the data never goes stale.
 */
function createBookingState(fixture, now = Date.now()) {
  const providers = fixture.providers.map((provider) => {
    const timezone = normalizeTimezone(provider.timezone, provider.country, now);
    return { ...structuredClone(provider), timezone, today: zonedNow(timezone.zone, now).date };
  });
  const byId = new Map(providers.map((p) => [p.id, p]));
  const dateFor = (providerId, dayOffset) => addDays(byId.get(providerId).today, dayOffset);

  const closures = fixture.closures
    .filter((c) => byId.has(c.providerId))
    .map((c) => ({ ...c, date: dateFor(c.providerId, c.dayOffset) }));

  /** key → id of the booking that holds it ('seed' for other customers' bookings). */
  const booked = new Map();
  for (const slot of fixture.bookedSlots) {
    if (byId.has(slot.providerId)) booked.set(bookedKey(slot.providerId, slot.specialistId, dateFor(slot.providerId, slot.dayOffset), slot.startTime), 'seed');
  }

  const bookings = new Map();
  const existing = fixture.existingBooking;
  if (existing && byId.has(existing.providerId)) {
    const record = {
      bookingId: existing.bookingId,
      providerId: existing.providerId,
      specialistId: existing.specialistId,
      date: dateFor(existing.providerId, existing.dayOffset),
      startTime: existing.startTime,
      numberOfPeople: existing.numberOfPeople || 1,
    };
    const day = buildDay({ providers, closures, booked, bookings }, record.providerId, record.specialistId, record.date, record.numberOfPeople, { now: -Infinity });
    const start = day.slots.findIndex((s) => s.startTime === record.startTime);
    record.startTimes = start >= 0 ? day.slots.slice(start, start + record.numberOfPeople).map((s) => s.startTime) : [record.startTime];
    for (const time of record.startTimes) booked.set(bookedKey(record.providerId, record.specialistId, record.date, time), record.bookingId);
    bookings.set(record.bookingId, record);
  }

  return { providers, closures, booked, bookings, idempotency: new Map(), existingBookingId: existing ? existing.bookingId : null };
}

function findProvider(state, providerId) {
  return state.providers.find((p) => String(p.id) === String(providerId)) || null;
}

// ------------------------------------------------------------------ slots

/**
 * Availability for one specialist on one provider-local date.
 * Slots start at consultation.startTime every duration + buffer minutes and
 * must end by consultation.endTime; only slots entirely inside the provider's
 * opening hours are offered. `window` explains any trimming to the customer.
 */
function buildDay(state, providerId, specialistId, date, people = 1, options = {}) {
  const now = options.now ?? Date.now();
  const provider = findProvider(state, providerId);
  if (!provider) return { status: 'not-found', message: 'Provider not found.', slots: [] };
  const specialist = (provider.specialists || []).find((s) => s.id === specialistId);
  if (!specialist) return { status: 'not-found', message: 'Specialist not found.', slots: [] };
  if (!isDateString(date)) return { status: 'invalid', message: 'Choose a valid date.', slots: [] };

  const zone = provider.timezone.zone;
  const live = zonedNow(zone, now === -Infinity ? 0 : now);
  // "Today" is the provider's live date, so the 90-day window rolls over at the
  // provider's midnight even if the mock keeps running (-Infinity: seeding).
  const today = now === -Infinity ? provider.today : live.date;
  const offset = daysBetween(today, date);
  const consultation = specialist.consultation;
  const schedule = provider.daySchedules ? provider.daySchedules[weekdayName(date)] : undefined;
  const base = {
    date,
    timezone: zone,
    providerToday: today,
    window: {
      consultation: { start: consultation.startTime, end: consultation.endTime },
      opening: schedule ? { start: schedule.startTime, end: schedule.endTime } : null,
      bookable: null,
    },
    slots: [],
  };

  if (offset < 0) return { ...base, status: 'past', message: 'This day has already passed at the provider.' };
  if (offset >= BOOKING_WINDOW_DAYS) return { ...base, status: 'outside-window', message: `Bookings open ${BOOKING_WINDOW_DAYS} days ahead.` };
  const closure = state.closures.find((c) => c.providerId === provider.id && c.date === date);
  if (closure) return { ...base, status: 'closure', message: `Closed: ${closure.reason || 'provider closure'}.` };
  if (!schedule) return { ...base, status: 'weekly-closed', message: `${provider.name} is closed on ${weekdayName(date)}s.` };

  const duration = Number(consultation.durationInMinutes);
  const step = duration + Number(consultation.bufferInMinutes || 0);
  const consultStart = toMinutes(consultation.startTime);
  const consultEnd = toMinutes(consultation.endTime);
  const openStart = toMinutes(schedule.startTime);
  const openEnd = toMinutes(schedule.endTime);

  const grid = [];
  let sequence = 0;
  for (let start = consultStart; start + duration <= consultEnd && step > 0; start += step, sequence += 1) {
    const end = start + duration;
    if (start < openStart || end > openEnd) continue; // outside opening hours: not offered
    const startTime = toClock(start);
    const holder = state.booked.get(bookedKey(provider.id, specialistId, date, startTime));
    const isCurrentBooking = Boolean(options.excludeBookingId && holder === options.excludeBookingId);
    const isBooked = Boolean(holder) && !isCurrentBooking;
    const isPast = now !== -Infinity && date === live.date && start <= live.minutes;
    grid.push({
      startTime,
      endTime: toClock(end),
      startUtc: new Date(zonedTimeToUtc(date, startTime, zone)).toISOString(),
      endUtc: new Date(zonedTimeToUtc(date, toClock(end), zone)).toISOString(),
      sequence,
      free: !isBooked && !isPast,
      isBooked,
      isPast,
      isCurrentBooking,
    });
  }

  // Group bookings: N consecutive grid slots (buffers included), all free.
  const slots = grid.map((slot, index) => {
    const run = grid.slice(index, index + people);
    const consecutive =
      run.length === people && run.every((s, i) => s.free && (i === 0 || s.sequence === run[i - 1].sequence + 1));
    const slotState = slot.isPast ? 'past' : slot.isBooked ? 'booked' : consecutive ? 'free' : 'insufficient';
    return {
      startTime: slot.startTime,
      endTime: slot.endTime,
      startUtc: slot.startUtc,
      endUtc: slot.endUtc,
      state: slotState,
      isCurrentBooking: slot.isCurrentBooking,
      groupTimes: consecutive ? run.map((s) => s.startTime) : [],
    };
  });

  base.window.bookable = grid.length ? { start: grid[0].startTime, end: grid[grid.length - 1].endTime } : null;
  const result = { ...base, slots };
  if (grid.length === 0) {
    return { ...result, status: 'no-overlap', message: `${specialist.name} consults ${consultation.startTime}–${consultation.endTime}, but ${provider.name} is open ${schedule.startTime}–${schedule.endTime} that day, so no appointment fits.` };
  }
  const bookable = slots.filter((s) => s.state === 'free' && !s.isCurrentBooking);
  if (bookable.length === 0) {
    const allPast = slots.every((s) => s.state === 'past');
    return {
      ...result,
      status: allPast ? 'past' : 'fully-booked',
      message: allPast
        ? 'All times today have already started at the provider.'
        : people > 1
          ? `No ${people} consecutive free times with this specialist on this day.`
          : 'Every time with this specialist is booked on this day.',
    };
  }
  return { ...result, status: 'available', message: null };
}

/** One entry per day in the 90-day window, with its status and reason. */
function buildCalendar(state, providerId, specialistId, people = 1, options = {}) {
  const provider = findProvider(state, providerId);
  if (!provider) return null;
  const today = zonedNow(provider.timezone.zone, options.now ?? Date.now()).date;
  const days = [];
  for (let i = 0; i < BOOKING_WINDOW_DAYS; i += 1) {
    const date = addDays(today, i);
    const day = buildDay(state, provider.id, specialistId, date, people, options);
    days.push({
      date,
      status: day.status,
      message: day.message,
      freeCount: day.slots.filter((s) => s.state === 'free' && !s.isCurrentBooking).length,
    });
  }
  return { providerId: provider.id, timezone: provider.timezone.zone, today, days };
}

// --------------------------------------------------------------- bookings

function reserve(state, booking, slotsTimes) {
  for (const time of slotsTimes) state.booked.set(bookedKey(booking.providerId, booking.specialistId, booking.date, time), booking.bookingId);
}

function release(state, booking) {
  for (const time of booking.startTimes || [booking.startTime]) {
    const key = bookedKey(booking.providerId, booking.specialistId, booking.date, time);
    if (state.booked.get(key) === booking.bookingId) state.booked.delete(key);
  }
}

/**
 * Simulate another customer booking the requested time just before this
 * request arrives (fault injection). For a reschedule, `bookingId` supplies
 * the provider and specialist. A time held by any booking is left alone.
 */
function takeSlot(state, body, bookingId = null) {
  const current = bookingId ? state.bookings.get(bookingId) : null;
  const provider = findProvider(state, current ? current.providerId : body && body.providerId);
  const specialistId = current ? current.specialistId : body && body.specialistId;
  if (!provider || !specialistId || !body || !isDateString(body.date) || !body.startTime) return;
  const key = bookedKey(provider.id, specialistId, body.date, body.startTime);
  if (!state.booked.has(key)) state.booked.set(key, 'seed');
}

function conflict(state, day, startTime, message) {
  const alternatives = day.slots ? day.slots.filter((s) => s.state === 'free' && !s.isCurrentBooking && s.startTime !== startTime).map((s) => s.startTime) : [];
  return { status: 409, body: { message, code: 'slot-taken', alternatives } };
}

/** Idempotent: the same key and payload return the original result. */
function idempotent(state, key, payload, run) {
  if (!key) return run();
  const fingerprint = JSON.stringify(payload);
  const previous = state.idempotency.get(key);
  if (previous) {
    return previous.fingerprint === fingerprint
      ? previous.result
      : { status: 409, body: { message: 'This request was already sent with different details.', code: 'idempotency-mismatch' } };
  }
  const result = run();
  if (result.status < 300) state.idempotency.set(key, { fingerprint, result });
  return result;
}

function createBooking(state, body, options = {}) {
  const { providerId, specialistId, date, startTime, idempotencyKey } = body || {};
  const people = Number((body && body.numberOfPeople) || 1);
  const payload = { providerId, specialistId, date, startTime, people };
  return idempotent(state, idempotencyKey, payload, () => {
    if (!Number.isInteger(people) || people < 1 || people > MAX_PEOPLE) {
      return { status: 422, body: { message: `Bookings are for 1 to ${MAX_PEOPLE} people.` } };
    }
    const day = buildDay(state, providerId, specialistId, date, people, options);
    if (day.status === 'not-found') return { status: 404, body: { message: day.message } };
    const slot = day.slots.find((s) => s.startTime === startTime);
    if (!slot || slot.state !== 'free') return conflict(state, day, startTime, 'Someone else booked this time just before you.');
    const booking = {
      bookingId: `BK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      providerId: Number(providerId),
      specialistId,
      date,
      startTime,
      startTimes: slot.groupTimes,
      numberOfPeople: people,
    };
    reserve(state, booking, slot.groupTimes);
    state.bookings.set(booking.bookingId, booking);
    return { status: 201, body: describeBooking(state, booking) };
  });
}

function rescheduleBooking(state, bookingId, body, options = {}) {
  const current = state.bookings.get(bookingId);
  if (!current) return { status: 404, body: { message: 'Booking not found.' } };
  const { date, startTime, idempotencyKey } = body || {};
  return idempotent(state, idempotencyKey, { bookingId, date, startTime }, () => {
    const day = buildDay(state, current.providerId, current.specialistId, date, current.numberOfPeople, { ...options, excludeBookingId: bookingId });
    const slot = day.slots.find((s) => s.startTime === startTime);
    if (slot && slot.isCurrentBooking && date === current.date) {
      return { status: 422, body: { message: 'That is already your appointment time.' } };
    }
    if (!slot || slot.state !== 'free') return conflict(state, day, startTime, 'That new time was just taken. Your current booking is unchanged.');
    release(state, current);
    const updated = { ...current, date, startTime, startTimes: slot.groupTimes };
    reserve(state, updated, slot.groupTimes);
    state.bookings.set(bookingId, updated);
    return { status: 200, body: { ...describeBooking(state, updated), status: 'rescheduled' } };
  });
}

function describeBooking(state, booking) {
  const provider = findProvider(state, booking.providerId);
  const zone = provider.timezone.zone;
  return {
    bookingId: booking.bookingId,
    providerId: booking.providerId,
    specialistId: booking.specialistId,
    date: booking.date,
    startTime: booking.startTime,
    startTimes: booking.startTimes,
    numberOfPeople: booking.numberOfPeople,
    timezone: zone,
    startUtc: new Date(zonedTimeToUtc(booking.date, booking.startTime, zone)).toISOString(),
  };
}

function describeProvider(provider, now = Date.now()) {
  return {
    id: provider.id,
    name: provider.name,
    country: provider.country,
    timezone: provider.timezone,
    today: zonedNow(provider.timezone.zone, now).date,
    daySchedules: provider.daySchedules,
    specialists: provider.specialists,
  };
}

module.exports = {
  BOOKING_WINDOW_DAYS,
  MAX_PEOPLE,
  normalizeTimezone,
  parseOffset,
  zoneOffsetMinutes,
  zonedNow,
  zonedTimeToUtc,
  addDays,
  createBookingState,
  findProvider,
  buildDay,
  buildCalendar,
  takeSlot,
  createBooking,
  rescheduleBooking,
  describeBooking,
  describeProvider,
};
