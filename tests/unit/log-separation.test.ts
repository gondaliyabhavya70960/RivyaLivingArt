import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { findLogSeparationViolations } from '../../scripts/logging/log-separation.mjs'

/**
 * Three logs, three jobs — Phase 38. The gate is run against a fixture tree containing the offence
 * (one event sent to both `writeAudit()` and `logSystem()`), so it has been watched refusing, and
 * against the repository as it stands.
 */

let root: string | null = null
afterEach(() => {
  if (root !== null) rmSync(root, { recursive: true, force: true })
  root = null
})

function tree(files: Readonly<Record<string, string>>): string {
  root = mkdtempSync(join(tmpdir(), 'log-separation-'))
  for (const [path, source] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), source, 'utf8')
  }
  return root
}

describe('the log-separation gate', () => {
  it('passes the repository as it stands', () => {
    expect(findLogSeparationViolations(resolve(__dirname, '../..'))).toEqual([])
  })

  it('refuses a module sending one event to both logs', () => {
    const cwd = tree({
      'app/x/actions.ts':
        "await writeAudit({ action: 'thing.done', result: 'SUCCESS' })\nawait logSystem({ level: 'INFO', channel: 'SYSTEM', event: 'thing.done', message: 'x' })\n",
    })
    expect(findLogSeparationViolations(cwd)).toEqual(['app/x/actions.ts: thing.done'])
  })

  it('permits a module that sends different events to each', () => {
    const cwd = tree({
      'app/x/actions.ts':
        "await writeAudit({ action: 'thing.done', result: 'SUCCESS' })\nawait logSystem({ level: 'INFO', channel: 'SYSTEM', event: 'thing.machine', message: 'x' })\n",
    })
    expect(findLogSeparationViolations(cwd)).toEqual([])
  })
})
