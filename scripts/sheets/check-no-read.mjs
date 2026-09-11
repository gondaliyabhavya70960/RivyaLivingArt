#!/usr/bin/env node
/**
 * sheets:check-no-read — fails the build when anything under lib/sheets/ reads cell values back
 * from a spreadsheet. See no-read.mjs for the rule and the vocabulary.
 */
import { findSheetsReads } from './no-read.mjs'

const found = findSheetsReads(process.cwd())
if (found.length > 0) {
  console.error('\n✗ the Sheets integration reads a spreadsheet back into Rivya:\n')
  for (const entry of found) console.error(`    ${entry}`)
  console.error(
    '\n  The integration is one-way by construction: Rivya writes a tab, the sheet reads.\n' +
      '  A spreadsheet is not a source of truth, and an inbound path would be the easiest place\n' +
      '  in the whole system to inject a fabricated fact. Changing this needs an amendment.\n',
  )
  process.exit(1)
}
console.log(
  '✓ sheets one-way: nothing under lib/sheets/ reads cell values; the only GET is sheet structure',
)
