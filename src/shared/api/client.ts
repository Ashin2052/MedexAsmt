// The single HTTP boundary between the UI and the mock API. Requests go to
// same-origin /api/*, which the Vite dev server proxies to mock-api/.
type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined>
  signal?: AbortSignal
}

/**
 * - http:    the server answered with a non-2xx status
 * - network: no response (offline, connection reset, server down)
 * - aborted: the caller cancelled the request
 * - parse:   a 2xx response whose body was not valid JSON
 */
export class ApiError extends Error {
  readonly kind: 'http' | 'network' | 'aborted' | 'parse'
  readonly status: number | null
  readonly details: unknown

  constructor(message: string, kind: ApiError['kind'], status: number | null = null, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.details = details
  }
}

async function readErrorBody(res: Response): Promise<{ message: string; details: unknown }> {
  const fallback = `Request failed with status ${res.status}.`
  try {
    const body = (await res.json()) as Record<string, unknown> | null
    if (body && typeof body === 'object') {
      const message = typeof body.message === 'string' ? body.message : fallback
      // Keep structured error data (e.g. a 409 with alternatives) for the caller.
      return { message, details: body.details ?? body }
    }
  } catch {
    // Non-JSON error body: use the generic message.
  }
  return { message: fallback, details: undefined }
}

/**
 * Perform a JSON request. Resolves with the parsed body (undefined for 204)
 * and rejects with ApiError. Features validate the shape at their boundary.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query = {}, signal } = options
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const url = params.size ? `${path}?${params}` : path

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('The request was cancelled.', 'aborted')
    }
    throw new ApiError("We couldn't reach the server. Check your connection and try again.", 'network')
  }

  if (!res.ok) {
    const { message, details } = await readErrorBody(res)
    throw new ApiError(message, 'http', res.status, details)
  }
  if (res.status === 204) return undefined as T

  try {
    return (await res.json()) as T
  } catch {
    throw new ApiError('The server sent an unreadable response.', 'parse', res.status)
  }
}

/**
 * True when a write may or may not have happened: no response at all, or a
 * gateway (502/504) that lost the upstream reply. Retry only with the same
 * idempotency key.
 */
export function isOutcomeUnknown(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true
  return error.kind !== 'http' || error.status === 502 || error.status === 504
}

/** Customer-facing explanation for a failed request. */
export function describeApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network') return error.message
    if (error.status !== null && error.status >= 500) {
      return 'Our server had a problem. Your choices are safe — please try again.'
    }
    return error.message
  }
  // A response that failed schema validation (zod) at a feature's API boundary.
  if (error instanceof Error && error.name === 'ZodError') {
    console.error('[api] Response did not match the expected shape:', error)
    return "We received data from the server that we couldn't read. Please try again later."
  }
  return 'Something went wrong. Please try again.'
}
