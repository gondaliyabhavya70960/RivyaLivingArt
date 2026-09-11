import type { SheetsClient } from './client'
import type { Cell } from './definitions'
import { SheetsWriteError } from './errors'
import { withRetry, type RetryOptions } from './retry'

/**
 * The atomic tab write — Phase 36.
 *
 * A READER SEES THE PREVIOUS COMPLETE TAB OR THE NEW COMPLETE ONE, NEVER A PARTIAL ONE. Every run
 * writes into `<tab>__staging` — created or cleared — in chunks of at most 5,000 cells, then one
 * `batchUpdate` deletes the live tab and renames the staging tab into its place. If anything fails
 * before that final request, the live tab is untouched and the staging tab is left in place with
 * the run id in A1 for diagnosis.
 *
 * EVERY NETWORK CALL IS WRAPPED IN THE SAME BOUNDED RETRY. A 429 or 5xx is retried with backoff;
 * a 401/403 is not retried at all. The attempt count reported is the largest any single call took.
 */

export const MAX_CELLS_PER_CHUNK = 5000
export const STAGING_SUFFIX = '__staging'

export interface TabWrite {
  readonly spreadsheetId: string
  readonly tab: string
  readonly header: readonly string[]
  readonly rows: readonly (readonly Cell[])[]
  readonly runId: string
}

export interface TabWriteResult {
  readonly cells: number
  readonly chunks: number
  readonly attempts: number
}

/** Rows per chunk, from the width: at most 5,000 cells and at least one row. */
export function rowsPerChunk(width: number): number {
  return Math.max(1, Math.floor(MAX_CELLS_PER_CHUNK / Math.max(1, width)))
}

export function chunkRows<T>(rows: readonly T[], width: number): readonly (readonly T[])[] {
  const size = rowsPerChunk(width)
  const chunks: T[][] = []
  for (let index = 0; index < rows.length; index += size)
    chunks.push([...rows.slice(index, index + size)])
  return chunks
}

/** A1 notation for a whole tab starting at a row: quotes doubled inside the sheet name. */
export function a1(tab: string, startRow: number): string {
  return `'${tab.replace(/'/gu, "''")}'!A${String(startRow)}`
}

export async function writeTabAtomically(
  client: SheetsClient,
  write: TabWrite,
  retry: RetryOptions = {},
): Promise<TabWriteResult> {
  const staging = `${write.tab}${STAGING_SUFFIX}`
  const width = write.header.length
  let attempts = 0
  const track = <T>(result: { readonly value: T; readonly attempts: number }): T => {
    attempts = Math.max(attempts, result.attempts)
    return result.value
  }

  // 1. What exists. Structure only — sheet ids and titles.
  const sheets = track(
    await withRetry(() => client.getSpreadsheetSheets(write.spreadsheetId), retry),
  )
  const live = sheets.find((sheet) => sheet.title === write.tab) ?? null
  let stagingSheet = sheets.find((sheet) => sheet.title === staging) ?? null

  // 2. A clean staging tab: cleared when it already exists, added when it does not.
  if (stagingSheet === null) {
    track(
      await withRetry(
        () =>
          client.batchUpdate(write.spreadsheetId, [
            { addSheet: { properties: { title: staging } } },
          ]),
        retry,
      ),
    )
    const after = track(
      await withRetry(() => client.getSpreadsheetSheets(write.spreadsheetId), retry),
    )
    stagingSheet = after.find((sheet) => sheet.title === staging) ?? null
    if (stagingSheet === null) throw new SheetsWriteError(null)
  } else {
    const sheetId = stagingSheet.sheetId
    track(
      await withRetry(
        () =>
          client.batchUpdate(write.spreadsheetId, [
            { updateCells: { range: { sheetId }, fields: '*' } },
          ]),
        retry,
      ),
    )
  }

  try {
    // 3. Header, then the rows in chunks. Data rows are padded to the header's width so the marker
    //    column is blank rather than absent.
    const padded = write.rows.map((row) => {
      const cells: Cell[] = [...row]
      while (cells.length < width) cells.push(null)
      return cells.slice(0, width)
    })
    track(
      await withRetry(
        () => client.putValues(write.spreadsheetId, a1(staging, 1), [write.header]),
        retry,
      ),
    )
    const chunks = chunkRows(padded, width)
    let nextRow = 2
    for (const chunk of chunks) {
      const startRow = nextRow
      track(
        await withRetry(
          () => client.putValues(write.spreadsheetId, a1(staging, startRow), chunk),
          retry,
        ),
      )
      nextRow += chunk.length
    }

    // 4. The swap: one request, so a reader never sees the gap.
    const swap: Record<string, unknown>[] = []
    if (live !== null) swap.push({ deleteSheet: { sheetId: live.sheetId } })
    swap.push({
      updateSheetProperties: {
        properties: { sheetId: stagingSheet.sheetId, title: write.tab },
        fields: 'title',
      },
    })
    track(await withRetry(() => client.batchUpdate(write.spreadsheetId, swap), retry))

    return { cells: width * (padded.length + 1), chunks: chunks.length, attempts }
  } catch (error) {
    // The live tab is untouched. Leave the run id in A1 of the staging tab, best effort.
    try {
      await client.putValues(write.spreadsheetId, a1(staging, 1), [
        [`run ${write.runId} failed before the swap`],
      ])
    } catch {
      // Diagnostic only; the original failure is what propagates.
    }
    throw error
  }
}
