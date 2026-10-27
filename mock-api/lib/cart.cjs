'use strict';
// Task 2 mock rules as plain functions over an explicit state object, so the
// route handlers in server.cjs stay thin and the rules are unit-tested
// (mock-api/lib/cart.test.mjs).

const crypto = require('node:crypto');

const MAX_QUANTITY = 20;
/** Card payments settle this long after the order is created. */
const CARD_SETTLE_MS = 2500;

function createCartState(fixture) {
  return {
    cart: recalculateCart(structuredClone(fixture.serverCart)),
    catalog: structuredClone(fixture.catalog),
    guestCart: structuredClone(fixture.guestCart),
    orders: new Map(),
    idempotency: new Map(),
    merges: new Map(),
  };
}

function isAvailable(line) {
  return Boolean(line.product && line.product.id && Object.keys(line.product).length > 0);
}

function wellnessOption(product, optionId) {
  return (product.wellnessPricing || []).find((option) => option.id === optionId) || null;
}

/** Final per-unit price, or null when unknown (unavailable, or wellness without a duration). */
function linePrice(line) {
  if (!isAvailable(line)) return null;
  const product = line.product;
  if (product.type === 'wellness') {
    const option = wellnessOption(product, line.wellnessPricingId);
    return option ? Number(option.amount_after_service_charge) : null;
  }
  const price = Number(product.price);
  return product.price !== null && Number.isFinite(price) ? price : null;
}

/** Recompute item counts, unpriced counts and per-currency subtotals (never across currencies). */
function recalculateCart(cart) {
  let totalItems = 0;
  cart.groups = (cart.groups || []).map((group) => {
    const subtotals = {};
    let itemCount = 0;
    let unpricedItems = 0;
    for (const line of group.items) {
      const quantity = Math.max(0, Number(line.quantity) || 0);
      itemCount += quantity;
      const price = linePrice(line);
      if (price === null) {
        unpricedItems += quantity;
      } else {
        const currency = line.product.currency || 'UNKNOWN';
        subtotals[currency] = (subtotals[currency] || 0) + price * quantity;
      }
    }
    totalItems += itemCount;
    return { ...group, itemCount, unpricedItems, subtotals };
  });
  cart.totalItems = totalItems;
  return cart;
}

function findLine(state, lineId) {
  for (const group of state.cart.groups) {
    const line = group.items.find((item) => item.id === lineId);
    if (line) return { group, line };
  }
  return null;
}

function ensureGroup(state, type) {
  let group = state.cart.groups.find((candidate) => candidate.type === type);
  if (!group) {
    group = { type, itemCount: 0, unpricedItems: 0, subtotals: {}, items: [] };
    state.cart.groups.push(group);
  }
  return group;
}

function clampQuantity(value) {
  const quantity = Math.floor(Number(value));
  if (!Number.isFinite(quantity) || quantity < 1) return 1;
  return Math.min(quantity, MAX_QUANTITY);
}

/**
 * Merge a guest cart into the account cart.
 *   same product   → quantities combined (capped at 20)
 *   new product    → added to its type group
 *   not in catalog → skipped and reported (never dropped silently)
 *   wellness       → guest duration applied when the account line has none;
 *                    an existing account choice is kept and reported;
 *                    no valid choice anywhere → reported as needing a choice
 * Idempotent per mergeId: replaying the same merge returns the first result.
 */
function mergeGuestCart(state, items, mergeId) {
  if (mergeId && state.merges.has(mergeId)) return state.merges.get(mergeId);

  const changes = [];
  for (const item of Array.isArray(items) ? items : []) {
    const productId = String(item && item.productId);
    const requested = clampQuantity(item && item.quantity);
    const product = state.catalog.find((candidate) => candidate.id === productId);
    if (!product) {
      changes.push({ productId, title: null, outcome: 'skipped', reason: 'not-available', quantity: requested });
      continue;
    }

    const guestOption =
      product.type === 'wellness' && item.wellnessPricingId ? wellnessOption(product, item.wellnessPricingId) : null;
    const existing = state.cart.groups
      .flatMap((group) => group.items)
      .find((line) => line.productId === productId && isAvailable(line));

    if (existing) {
      const before = existing.quantity;
      const after = Math.min(MAX_QUANTITY, before + requested);
      existing.quantity = after;
      const change = {
        productId,
        lineId: existing.id,
        title: product.title,
        outcome: 'quantity-combined',
        from: before,
        added: requested,
        to: after,
        capped: before + requested > MAX_QUANTITY,
      };
      if (product.type === 'wellness') {
        if (!existing.wellnessPricingId && guestOption) {
          existing.wellnessPricingId = guestOption.id;
          change.wellness = { status: 'applied', durationInMinutes: guestOption.durationInMinutes };
        } else if (existing.wellnessPricingId && guestOption && guestOption.id !== existing.wellnessPricingId) {
          const kept = wellnessOption(product, existing.wellnessPricingId);
          change.wellness = { status: 'kept-account-choice', durationInMinutes: kept ? kept.durationInMinutes : null };
        } else if (!existing.wellnessPricingId) {
          change.wellness = { status: 'needs-choice' };
        }
      }
      changes.push(change);
    } else {
      const line = {
        id: crypto.randomUUID(),
        productId,
        quantity: requested,
        ...(guestOption ? { wellnessPricingId: guestOption.id } : {}),
        product: structuredClone(product),
      };
      ensureGroup(state, product.type).items.push(line);
      const change = { productId, lineId: line.id, title: product.title, outcome: 'added', to: requested };
      if (product.type === 'wellness') {
        change.wellness = guestOption
          ? { status: 'applied', durationInMinutes: guestOption.durationInMinutes }
          : { status: 'needs-choice' };
      }
      changes.push(change);
    }
  }

  recalculateCart(state.cart);
  const result = { cart: state.cart, changes };
  if (mergeId) state.merges.set(mergeId, result);
  return result;
}

function updateLine(state, lineId, body) {
  const found = findLine(state, lineId);
  if (!found) return { status: 404, body: { message: 'Cart item not found.' } };
  if (!isAvailable(found.line)) {
    return { status: 409, body: { message: 'This service is no longer available. Remove it from your cart.' } };
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'quantity')) {
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return { status: 422, body: { message: `Quantity must be a whole number between 1 and ${MAX_QUANTITY}.` } };
    }
    found.line.quantity = quantity;
  } else if (Object.prototype.hasOwnProperty.call(body || {}, 'wellnessPricingId')) {
    const option = wellnessOption(found.line.product, body.wellnessPricingId);
    if (!option) return { status: 422, body: { message: 'Choose a valid duration for this treatment.' } };
    found.line.wellnessPricingId = option.id;
  } else {
    return { status: 400, body: { message: 'Provide quantity or wellnessPricingId.' } };
  }
  recalculateCart(state.cart);
  return { status: 200, body: { cart: state.cart } };
}

function removeLine(state, lineId) {
  const found = findLine(state, lineId);
  if (found) {
    found.group.items = found.group.items.filter((line) => line.id !== lineId);
    state.cart.groups = state.cart.groups.filter((group) => group.items.length > 0);
    recalculateCart(state.cart);
  }
  return { status: 204 };
}

function checkoutProblem(lines) {
  if (!lines.length) return 'There are no items to check out in this group.';
  for (const line of lines) {
    if (!isAvailable(line)) return 'Remove unavailable services before checkout.';
    if (linePrice(line) === null) return 'Choose a duration for every wellness treatment before checkout.';
  }
  return null;
}

/**
 * Create one order for one group. The idempotency key makes retries safe:
 * the same key with the same payload returns the original order; the same
 * key with a different payload is rejected with 409.
 */
function checkout(state, body, options = {}) {
  const now = options.now ?? Date.now();
  const { groupType, paymentMethod, idempotencyKey } = body || {};
  if (!groupType || !['card', 'pay_at_clinic'].includes(paymentMethod) || !idempotencyKey) {
    return { status: 400, body: { message: 'groupType, paymentMethod and idempotencyKey are required.' } };
  }
  const items = Array.isArray(body.items) ? body.items : [];
  const fingerprint = JSON.stringify({ groupType, paymentMethod, items });
  const previous = state.idempotency.get(idempotencyKey);
  if (previous) {
    if (previous.fingerprint !== fingerprint) {
      return { status: 409, body: { message: 'This checkout was already submitted with different details.', code: 'idempotency-mismatch' } };
    }
    return { status: 201, body: previous.response };
  }

  const group = state.cart.groups.find((candidate) => candidate.type === groupType);
  if (!group) return { status: 409, body: { message: 'This part of your cart has changed. Please review it.', code: 'cart-changed' } };
  let lines = group.items;
  if (items.length) {
    const wanted = new Set(items.map((item) => (typeof item === 'string' ? item : item.lineId || item.id)));
    lines = group.items.filter((line) => wanted.has(line.id));
    if (lines.length !== wanted.size) {
      return { status: 409, body: { message: 'Some items changed since you started checkout. Please review them.', code: 'cart-changed' } };
    }
  }
  const problem = checkoutProblem(lines);
  if (problem) return { status: 422, body: { message: problem } };

  const orderId = `ME-${now.toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const response = { orderId, status: 'pending' };
  state.orders.set(orderId, {
    orderId,
    groupType,
    paymentMethod,
    items: structuredClone(lines),
    createdAt: now,
  });
  state.idempotency.set(idempotencyKey, { fingerprint, response });
  const ordered = new Set(lines.map((line) => line.id));
  group.items = group.items.filter((line) => !ordered.has(line.id));
  state.cart.groups = state.cart.groups.filter((candidate) => candidate.items.length > 0);
  recalculateCart(state.cart);
  return { status: 201, body: response };
}

/** Card orders are paid after CARD_SETTLE_MS; pay-at-clinic orders stay pending until the visit. */
function orderStatus(order, now = Date.now()) {
  if (order.paymentMethod === 'pay_at_clinic') return 'pending';
  return now - order.createdAt >= CARD_SETTLE_MS ? 'paid' : 'pending';
}

module.exports = {
  CARD_SETTLE_MS,
  MAX_QUANTITY,
  createCartState,
  recalculateCart,
  mergeGuestCart,
  updateLine,
  removeLine,
  checkout,
  orderStatus,
};
