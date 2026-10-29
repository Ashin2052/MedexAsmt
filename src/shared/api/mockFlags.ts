// Opt-in fault injection for reviewing slow and failure states against the
// mock API. Open any page with, for example,
//   ?mock=checkout#2:500,slots:slow,bookings:409,checkout:lost
// Each rule is `<target>[#n]:<effect>` and fires once, on the nth request
// whose "METHOD /path" contains `target`. Effects: an HTTP status (400–599),
// `lost` (the server handles the request, then the reply is lost: 504) or
// `slow` (+3 s). Rules live in sessionStorage for this tab, so a reload keeps
// what is left of them; `?mock=off` clears them.
const STORAGE_KEY = 'medex.mockFlags.v1'
const SLOW_MS = 3000

export type MockRule = { target: string; nth: number; effect: string; seen: number }

const RULE = /^([^#:\s]+)(?:#(\d+))?:(\d{3}|lost|slow)$/i

/** Parse a `?mock=` value; malformed rules and statuses outside 400–599 are ignored. */
export function parseMockRules(value: string): MockRule[] {
  return value.split(',').flatMap((part) => {
    const match = RULE.exec(part.trim())
    if (!match) return []
    const effect = match[3].toLowerCase()
    if (/^\d+$/.test(effect) && (Number(effect) < 400 || Number(effect) > 599)) return []
    return [{ target: match[1].toLowerCase(), nth: Math.max(1, Number(match[2] ?? 1)), effect, seen: 0 }]
  })
}

function load(): MockRule[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as MockRule[]) : []
  } catch {
    return []
  }
}

let rules: MockRule[] = load()
const listeners = new Set<() => void>()

function save(next: MockRule[]) {
  rules = next
  try {
    if (next.length) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable: rules still apply until the page reloads.
  }
  listeners.forEach((listener) => listener())
}

/**
 * Read `?mock=` from the page URL once at start-up, then remove it from the
 * URL so a reload continues the same rules instead of re-arming them.
 */
export function captureMockFlags(location: Location = window.location) {
  const params = new URLSearchParams(location.search)
  const value = params.get('mock')
  if (value === null) return
  save(value === '' || value === 'off' ? [] : parseMockRules(value))
  params.delete('mock')
  const search = params.size ? `?${params}` : ''
  window.history.replaceState(window.history.state, '', `${location.pathname}${search}${location.hash}`)
}

/**
 * Headers for this request from the rules it triggers; triggered rules are
 * used up. `restore` gives them back when the request is aborted before it
 * counted (e.g. React StrictMode's dev double-mount cancels the first fetch).
 */
export function takeMockHeaders(method: string, path: string): { headers: Record<string, string>; restore: () => void } {
  const headers: Record<string, string> = {}
  const request = `${method} ${path}`.toLowerCase()
  // Each touched rule: [the original, its replacement (null when fired)].
  const touched: [MockRule, MockRule | null][] = []
  const next = rules.flatMap((rule) => {
    if (!request.includes(rule.target)) return [rule]
    const seen = rule.seen + 1
    if (seen < rule.nth) {
      const counted = { ...rule, seen }
      touched.push([rule, counted])
      return [counted]
    }
    if (rule.effect === 'slow') headers['x-mock-delay'] = String(SLOW_MS)
    else headers['x-mock-fault'] = rule.effect
    touched.push([rule, null])
    return []
  })
  if (!touched.length) return { headers, restore: () => {} }
  save(next)
  return {
    headers,
    restore: () => {
      const current = rules.map((rule) => touched.find(([, replacement]) => replacement === rule)?.[0] ?? rule)
      save([...current, ...touched.filter(([, replacement]) => replacement === null).map(([original]) => original)])
    },
  }
}

export const getMockRules = () => rules
export const clearMockRules = () => save([])
export function subscribeMockRules(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
