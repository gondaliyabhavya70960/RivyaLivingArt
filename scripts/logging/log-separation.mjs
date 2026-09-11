/**
 * Three logs, three jobs — Phase 38. A module that sends the same event name to `logSystem()` and
 * to `writeAudit()` has merged two of them: the audit trail would start carrying machine noise,
 * or the system log a human's act. This finds every file that names one event in both calls.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOTS = ['app', 'lib', 'scripts', 'components']
const EXTENSIONS = ['.ts', '.tsx']

function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (
      EXTENSIONS.some((extension) => entry.endsWith(extension)) &&
      !/\.test\.tsx?$/u.test(entry)
    ) {
      yield full
    }
  }
}

function literals(source, callName, field) {
  const found = new Set()
  const call = new RegExp(`${callName}\\(\\{`, 'gu')
  let match
  while ((match = call.exec(source)) !== null) {
    const slice = source.slice(match.index, match.index + 600)
    const value = new RegExp(`\\b${field}:\\s*['"\`]([^'"\`]+)['"\`]`, 'u').exec(slice)
    if (value !== null) found.add(value[1])
  }
  return found
}

/**
 * @param {string} root
 * @returns {string[]} `file: event` for every event both logs receive from one file
 */
export function findLogSeparationViolations(root) {
  const out = []
  for (const dir of ROOTS) {
    for (const file of walk(join(root, dir))) {
      const source = readFileSync(file, 'utf8')
      if (!source.includes('logSystem(') || !source.includes('writeAudit(')) continue
      const events = literals(source, 'logSystem', 'event')
      const actions = literals(source, 'writeAudit', 'action')
      for (const event of events) {
        if (actions.has(event)) out.push(`${relative(root, file).split('\\').join('/')}: ${event}`)
      }
    }
  }
  return out.sort()
}
