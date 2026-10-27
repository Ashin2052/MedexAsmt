import { useEffect, useState } from 'react'

/** Number of ms after which a pending request counts as "slow". */
const SLOW_REQUEST_MS = 2000

/** True once `active` has stayed true for `delayMs` (e.g. "Still loading…" hints). */
export function useDelayedFlag(active: boolean, delayMs = SLOW_REQUEST_MS): boolean {
  const [elapsed, setElapsed] = useState(false)
  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => setElapsed(true), delayMs)
    return () => {
      window.clearTimeout(timer)
      setElapsed(false)
    }
  }, [active, delayMs])
  return active && elapsed
}
