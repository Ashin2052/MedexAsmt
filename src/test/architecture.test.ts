import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcDir = resolve(process.cwd(), 'src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'test' ? [] : sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('architecture', () => {
  it('application code never imports the assessment JSON fixtures', () => {
    const offenders = sourceFiles(srcDir).filter((file) =>
      /from\s+['"][^'"]*(data\/|task\d-[\w-]+\.json)/.test(readFileSync(file, 'utf8')),
    )
    expect(offenders.map((file) => relative(srcDir, file))).toEqual([])
  })
})
