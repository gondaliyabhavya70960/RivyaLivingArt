#!/usr/bin/env node
import { findLogSeparationViolations } from './log-separation.mjs'

const violations = findLogSeparationViolations(process.cwd())
if (violations.length > 0) {
  console.error(
    '✗ three logs, three jobs: one event goes to both the audit log and the system log:',
  )
  for (const line of violations) console.error(`    ${line}`)
  console.error(
    '\n  audit_logs answers "who was allowed or refused to do what"; system_logs answers',
  )
  console.error(
    '  "what the machine did". Send an event to one of them (docs/ops/SECURITY.md §10).',
  )
  process.exit(1)
}
console.log('✓ log separation: no module sends one event to both writeAudit() and logSystem()')
