import { useEffect, useState } from 'react'

const URL_COMMIT_DELAY_MS = 300

/**
 * Keeps the search box responsive: the input value updates on every
 * keystroke, results follow via useDeferredValue in the page, and the URL is
 * written once typing pauses (with history replace, so each keystroke does
 * not become a back-button step). Back/forward updates the box from the URL.
 * `commit` must be stable (wrap it in useCallback).
 */
export function useSearchInput(urlQuery: string, commit: (value: string) => void) {
  const [value, setValue] = useState(urlQuery)
  const [syncedUrlQuery, setSyncedUrlQuery] = useState(urlQuery)

  // URL changed from outside (back/forward, chip removal, clear all).
  if (urlQuery !== syncedUrlQuery) {
    setSyncedUrlQuery(urlQuery)
    setValue(urlQuery)
  }

  const commitNow = () => {
    if (value.trim() === urlQuery.trim()) return
    setSyncedUrlQuery(value.trim())
    commit(value)
  }

  useEffect(() => {
    if (value.trim() === urlQuery.trim()) return
    const timer = window.setTimeout(() => {
      setSyncedUrlQuery(value.trim())
      commit(value)
    }, URL_COMMIT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [value, urlQuery, commit])

  return { value, setValue, commitNow }
}
