/**
 * CSV and TSV, parsed here and nowhere else.
 *
 * WRITTEN RATHER THAN TAKEN FROM A PACKAGE, and the reason is proportionality: what this needs is
 * RFC 4180 quoting, a delimiter that is either a comma or a tab, and CRLF tolerance. A parser
 * dependency for that is a supply-chain surface on a path that reads a file somebody uploaded.
 *
 * IT IS DELIBERATELY STRICT ABOUT ONE THING AND FORGIVING ABOUT EVERYTHING ELSE. A row with the
 * wrong number of cells is an ERROR, reported with its line number, because silently padding or
 * truncating it is how a column shifts by one and forty products get the previous row's price. A
 * blank line, a trailing newline, a BOM, `\r\n`, quotes around a value that did not need them: all
 * accepted without comment.
 */

export type Delimiter = ',' | '\t'

export interface ParsedFile {
  readonly headers: readonly string[]
  readonly rows: ReadonlyArray<{
    /** The line in the operator's own file, 1-based and counting the header. */
    readonly rowNumber: number
    readonly cells: readonly string[]
  }>
  readonly errors: ReadonlyArray<{ rowNumber: number; message: string }>
}

/** A tab in the first line and no comma means TSV. Guessed, then confirmed by the operator. */
export function detectDelimiter(text: string): Delimiter {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const commas = (firstLine.match(/,/g) ?? []).length
  const tabs = (firstLine.match(/\t/g) ?? []).length
  return tabs > commas ? '\t' : ','
}

/** One line into cells, honouring RFC 4180 quoting. */
function splitLine(line: string, delimiter: Delimiter): string[] {
  const cells: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]

    if (inQuotes) {
      if (character === '"') {
        // `""` inside a quoted field is a literal quote — RFC 4180's escape.
        if (line[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += character
      }
      continue
    }

    if (character === '"' && cell === '') inQuotes = true
    else if (character === delimiter) {
      cells.push(cell)
      cell = ''
    } else cell += character
  }

  cells.push(cell)
  return cells
}

export function parseDelimited(text: string, delimiter: Delimiter): ParsedFile {
  // A UTF-8 BOM survives a round trip through Excel and would otherwise become part of the first
  // header's name, so the very first column would never map to anything.
  const clean = text.replace(/^﻿/, '')

  const lines = clean.split(/\r?\n/)
  const errors: Array<{ rowNumber: number; message: string }> = []

  let headers: string[] = []
  const rows: Array<{ rowNumber: number; cells: string[] }> = []

  for (const [index, line] of lines.entries()) {
    const rowNumber = index + 1
    if (line.trim() === '') continue

    const cells = splitLine(line, delimiter).map((cell) => cell.trim())

    if (headers.length === 0) {
      headers = cells
      continue
    }

    if (cells.length !== headers.length) {
      // NAMED AND COUNTED, because "row 41 has 8 values where the header has 9" is something an
      // operator can find and fix; "import failed" is not.
      errors.push({
        rowNumber,
        message: `${cells.length} value(s) where the header has ${headers.length}.`,
      })
      continue
    }

    rows.push({ rowNumber, cells })
  }

  if (headers.length === 0) {
    errors.push({ rowNumber: 1, message: 'The file has no header row.' })
  }

  return { headers, rows, errors }
}
