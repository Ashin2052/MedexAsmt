import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom lacks browser APIs that Radix primitives (shadcn/ui) rely on.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// Node-environment tests (mock-api) have no DOM.
if (typeof Element !== 'undefined') {
  globalThis.ResizeObserver ??= ResizeObserverStub
  Element.prototype.scrollIntoView ??= () => {}
  Element.prototype.hasPointerCapture ??= () => false
}

afterEach(() => {
  cleanup()
})
