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
  // Our own write still on its way to the URL: when it lands, the box already
  // shows it (maybe with more typed since), so it must not overwrite the box.
  const [committed, setCommitted] = useState<string | null>(null)

  // URL changed: adopt it unless it is our own commit arriving
  // (back/forward, chip removal and clear all are adopted).
  if (urlQuery !== syncedUrlQuery) {
    setSyncedUrlQuery(urlQuery)
    if (urlQuery === committed) setCommitted(null)
    else setValue(urlQuery)
  }

  const commitNow = () => {
    if (value.trim() === urlQuery.trim()) return
    setCommitted(value.trim())
    commit(value)
  }

  useEffect(() => {
    if (value.trim() === urlQuery.trim()) return
    const timer = window.setTimeout(() => {
      setCommitted(value.trim())
      commit(value)
    }, URL_COMMIT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [value, urlQuery, commit])

  return { value, setValue, commitNow }
}
