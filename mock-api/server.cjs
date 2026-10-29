/*
 * MedEx assessment mock API.
 * - JSON Server 0.17.4 serves the Task 1 collections (read-only).
 * - Custom routes cover what JSON Server cannot: Task 2 cart/checkout
 *   (idempotency, merge rules) and Task 3 booking (slots, time zones, 409s).
 *   The rules live in lib/cart.cjs and lib/booking.cjs.
 * - Every /api response waits a fixed RESPONSE_DELAY_MS, so loading states
 *   are visible the way they would be against a real server.
 * - Opt-in fault injection through the `x-mock-fault` / `x-mock-delay`
 *   headers, which the app sends only for ?mock= rules (see README).
 *
 * This is an in-memory assessment simulator, not a production backend.
 */
const path = require('node:path');
const fs = require('node:fs');
const jsonServer = require('json-server');
const cartLib = require('./lib/cart.cjs');
const bookingLib = require('./lib/booking.cjs');

const RESPONSE_DELAY_MS = 1500;

function readJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', filename), 'utf8'));
}

const task1 = readJson('task1-service-explorer.json');
const task2 = readJson('task2-cart.json');
const task3 = readJson('task3-booking.json');

/**
 * Build the app. `now` is injectable so tests can fix or advance the clock,
 * and tests pass `delayMs: 0`.
 */
function createApp({ now = Date.now, delayMs = RESPONSE_DELAY_MS } = {}) {
  const app = jsonServer.create();
  const cartState = cartLib.createCartState(task2);
  // Day offsets become real dates relative to each provider's "today" here.
  const bookingState = bookingLib.createBookingState(task3, now());
  app.locals.state = () => ({ cart: cartState, booking: bookingState });

  const error = (res, status, message) => res.status(status).json({ message });
  const send = (res, result) => (result.status === 204 ? res.sendStatus(204) : res.status(result.status).json(result.body));

  app.use(jsonServer.bodyParser);

  // `x-mock-delay` adds latency to one request (the app sends it for ?mock=…:slow).
  app.use('/api', (req, _res, next) => setTimeout(next, delayMs + Math.min(Number(req.get('x-mock-delay')) || 0, 30000)));

  // Opt-in fault injection: the app sends `x-mock-fault` only for requests a
  // ?mock= rule targets (src/shared/api/mockFlags.ts). Without it nothing changes.
  app.use('/api', (req, res, next) => {
    const fault = String(req.get('x-mock-fault') || '');
    if (fault === 'lost') {
      // The request is handled (an order or booking may be created), then the reply is lost.
      const end = res.end.bind(res);
      res.end = () => {
        const body = JSON.stringify({ message: 'Gateway timeout (simulated): the reply was lost after the request was handled.' });
        res.statusCode = 504;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Length', Buffer.byteLength(body));
        return end(body);
      };
      return next();
    }
    const status = Number(fault);
    if (!Number.isInteger(status) || status < 400 || status > 599) return next();
    // A booking 409 is made real: another customer takes the time first, so the
    // route answers with its usual message and genuine alternatives.
    if (status === 409 && req.path.startsWith('/bookings') && (req.method === 'POST' || req.method === 'PUT')) {
      const bookingId = req.method === 'PUT' ? req.path.split('/')[2] : null;
      bookingLib.takeSlot(bookingState, req.body, bookingId);
      return next();
    }
    error(res, status, `Simulated ${status} (mock flag).`);
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'medex-mock-api' }));

  // ----------------------------- Task 2: Cart -----------------------------
  app.get('/api/cart', (_req, res) => res.json({ cart: cartLib.recalculateCart(cartState.cart) }));

  app.patch('/api/cart/items/:lineId', (req, res) => send(res, cartLib.updateLine(cartState, req.params.lineId, req.body)));

  app.delete('/api/cart/items/:lineId', (req, res) => send(res, cartLib.removeLine(cartState, req.params.lineId)));

  app.post('/api/cart/merge', (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : cartState.guestCart;
    res.json(cartLib.mergeGuestCart(cartState, items, req.body.mergeId));
  });

  // What a guest stored on their device before logging in (seeds the demo).
  app.get('/api/cart/guest-sample', (_req, res) => res.json({ items: cartState.guestCart }));

  app.post('/api/checkout', (req, res) => send(res, cartLib.checkout(cartState, req.body, { now: now() })));

  app.get('/api/orders/:orderId', (req, res) => {
    const order = cartState.orders.get(req.params.orderId);
    if (!order) return error(res, 404, 'Order not found in this mock session.');
    res.json({ orderId: order.orderId, status: cartLib.orderStatus(order, now()) });
  });

  // --------------------------- Task 3: Booking ---------------------------
  const availability = (req) => ({
    specialistId: String(req.query.specialistId || ''),
    people: Number(req.query.people || 1),
    options: { now: now(), excludeBookingId: req.query.excludeBookingId ? String(req.query.excludeBookingId) : undefined },
  });

  app.get('/api/booking/providers', (_req, res) => {
    res.json({ providers: bookingState.providers.map((p) => bookingLib.describeProvider(p, now())) });
  });

  app.get('/api/booking/providers/:id', (req, res) => {
    const provider = bookingLib.findProvider(bookingState, req.params.id);
    if (!provider) return error(res, 404, 'Provider not found.');
    res.json({ provider: bookingLib.describeProvider(provider, now()) });
  });

  // 90 days of availability with a reason for each unavailable day.
  app.get('/api/booking/providers/:id/calendar', (req, res) => {
    const provider = bookingLib.findProvider(bookingState, req.params.id);
    if (!provider) return error(res, 404, 'Provider not found.');
    const { specialistId, people, options } = availability(req);
    res.json(bookingLib.buildCalendar(bookingState, provider.id, specialistId, people, options));
  });

  app.get('/api/booking/providers/:id/slots', (req, res) => {
    const provider = bookingLib.findProvider(bookingState, req.params.id);
    if (!provider) return error(res, 404, 'Provider not found.');
    const { specialistId, people, options } = availability(req);
    const day = bookingLib.buildDay(bookingState, provider.id, specialistId, String(req.query.date || ''), people, options);
    if (day.status === 'not-found') return error(res, 404, day.message);
    res.json(day);
  });

  app.get('/api/bookings/:id', (req, res) => {
    const id = req.params.id === 'existing' ? bookingState.existingBookingId : req.params.id;
    const booking = bookingState.bookings.get(id);
    if (!booking) return error(res, 404, 'Booking not found.');
    res.json({ booking: bookingLib.describeBooking(bookingState, booking) });
  });

  app.post('/api/bookings', (req, res) => send(res, bookingLib.createBooking(bookingState, req.body, { now: now() })));

  app.put('/api/bookings/:id', (req, res) => send(res, bookingLib.rescheduleBooking(bookingState, req.params.id, req.body, { now: now() })));

  // ---------------------- Task 1: JSON Server (read-only) ----------------------
  app.use('/api/explorer', (req, res, next) => (req.method === 'GET' ? next() : error(res, 405, 'Read-only.')));
  app.use('/api/explorer', jsonServer.router({ categories: task1.categories, providers: task1.providers, services: task1.services }));

  app.use('/api', (_req, res) => error(res, 404, 'Mock API endpoint not found.'));
  return app;
}

module.exports = { createApp };

if (require.main === module) {
  const port = Number(process.env.MOCK_API_PORT || 4010);
  createApp().listen(port, () => console.log(`MedEx mock API listening on http://localhost:${port}`));
}
