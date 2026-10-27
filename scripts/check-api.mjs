// Smoke-check a running mock API: health and one representative endpoint per
// task. Uses Node's built-in fetch, so it
// works without curl. Usage: `npm run check:api [baseUrl]`.
const base = (process.argv[2] || process.env.MOCK_API_URL || 'http://localhost:4010').replace(/\/+$/, '')

const checks = [
  ['health', '/health', (s, b) => s === 200 && b.status === 'ok'],
  ['task1 categories', '/api/explorer/categories', (s, b) => s === 200 && b.length === 13],
  ['task1 providers', '/api/explorer/providers', (s, b) => s === 200 && b.length === 67],
  ['task1 services', '/api/explorer/services', (s, b) => s === 200 && b.length === 3200],
  ['task2 cart', '/api/cart', (s, b) => s === 200 && Array.isArray(b.cart?.groups)],
  ['task3 providers', '/api/booking/providers', (s, b) => s === 200 && b.providers?.length === 6],
  ['task3 existing booking', '/api/bookings/existing', (s, b) => s === 200 && Boolean(b.booking?.bookingId)],
]

let failed = 0
for (const [label, path, ok] of checks) {
  const started = performance.now()
  try {
    const res = await fetch(base + path)
    const body = await res.json().catch(() => null)
    const passed = ok(res.status, body ?? {})
    if (!passed) failed += 1
    const ms = Math.round(performance.now() - started)
    console.log(`${passed ? 'PASS' : 'FAIL'}  ${label.padEnd(24)} ${res.status}  ${ms}ms  ${path}`)
  } catch (error) {
    failed += 1
    console.log(`FAIL  ${label.padEnd(24)} ${error.cause?.code ?? error.message}  ${path}`)
  }
}

console.log(failed ? `\n${failed} check(s) failed against ${base}` : `\nAll checks passed against ${base}`)
process.exitCode = failed ? 1 : 0
