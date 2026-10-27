// One-command local development: starts the mock replication API
// (mock-api/server.cjs) and the Vite dev server together, and stops both
// when either exits or the terminal is interrupted. Extra CLI arguments are
// forwarded to Vite (e.g. `npm run dev -- --port 5174`).
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

if (!existsSync(new URL('../mock-api/node_modules', import.meta.url))) {
  console.error('mock-api dependencies are missing. Run `npm install` (or `npm --prefix mock-api install`).')
  process.exit(1)
}

const children = [
  // --watch restarts the mock when its code changes, so the API never runs stale code
  // (in-memory mock data resets on each restart).
  spawn(process.execPath, ['--watch', 'mock-api/server.cjs'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...process.argv.slice(2)], {
    cwd: root,
    stdio: 'inherit',
  }),
]

let stopping = false
function stopAll(code) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM')
  }
  process.exitCode = code
}

for (const child of children) {
  child.on('exit', (code) => stopAll(code ?? 0))
}
process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))
