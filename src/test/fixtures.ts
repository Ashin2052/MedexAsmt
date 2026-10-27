// Test-only access to the original assessment fixtures. Application code
// never imports data/*.json; it fetches them through the mock API.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Vitest runs from the repository root (where vitest.config.ts lives).
function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'data', name), 'utf8'))
}

type ExplorerFixture = { categories: unknown[]; providers: unknown[]; services: unknown[] }

let explorerCache: ExplorerFixture | null = null

export function explorerFixture(): ExplorerFixture {
  explorerCache ??= readFixture('task1-service-explorer.json') as ExplorerFixture
  return explorerCache
}
