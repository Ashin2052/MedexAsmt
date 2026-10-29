import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSearchInput } from './useSearchInput'

// The router writes the URL after the commit, so the URL arrives on a later
// render: the hook must keep the box steady in between.
function setup(initialUrl = '') {
  const commit = vi.fn()
  const hook = renderHook(({ url }) => useSearchInput(url, commit), { initialProps: { url: initialUrl } })
  const type = (value: string) => act(() => hook.result.current.setValue(value))
  const urlBecomes = (url: string) => hook.rerender({ url })
  return { hook, commit, type, urlBecomes }
}

describe('useSearchInput', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('keeps the typed text while its own commit is on its way to the URL', () => {
    const { hook, commit, type, urlBecomes } = setup()
    type('full body')
    act(() => vi.advanceTimersByTime(300))
    expect(commit).toHaveBeenCalledWith('full body')
    expect(hook.result.current.value).toBe('full body') // was briefly '' before the fix

    type('full body check') // still typing when the URL lands
    urlBecomes('full body')
    expect(hook.result.current.value).toBe('full body check')
  })

  it('keeps a trailing space when the trimmed commit lands', () => {
    const { hook, type, urlBecomes } = setup()
    type('full ')
    act(() => vi.advanceTimersByTime(300))
    urlBecomes('full')
    expect(hook.result.current.value).toBe('full ')
  })

  it('adopts URL changes made elsewhere (back/forward, chips), even back to an earlier commit', () => {
    const { hook, type, urlBecomes } = setup()
    type('scan')
    act(() => vi.advanceTimersByTime(300))
    urlBecomes('scan')
    urlBecomes('')
    expect(hook.result.current.value).toBe('')
    urlBecomes('scan') // forward again
    expect(hook.result.current.value).toBe('scan')
  })
})
