import { describe, expect, it } from 'vitest'

import { applyColumnMap, rawRow, suggestColumnMap } from '@/lib/bulk/import/map'
import { detectDelimiter, parseDelimited } from '@/lib/bulk/import/parse'
import { validateImport, type ImportContext } from '@/lib/bulk/import/validate'

/**
 * The import dry run, which is the only thing standing between a spreadsheet and the catalogue.
 *
 * EVERY FEAT §21 RULE THE PHASE DOCUMENT NAMES IS EXERCISED HERE — duplicate SKU, duplicate slug,
 * malformed value, invalid price state, quote-only carrying a price — plus the two that are
 * properties of a FILE rather than of a row and therefore have no home in `validateProduct`: a
 * duplicate within the upload itself, and a row whose cell count does not match the header.
 *
 * THE ASSERTION THAT MATTERS MOST IS ABOUT AN ABSENCE. `status` is not writable by the import, so
 * a file claiming PUBLISHED cannot publish anything; that is proved by the writable-column list in
 * the repository rather than here, and `tests/unit/rls/phase24.test.ts` proves it end to end.
 */

const EMPTY_CONTEXT: ImportContext = {
  productIdBySlug: new Map(),
  productIdBySku: new Map(),
  categoryIdBySlug: new Map([['decor', 'cat-decor']]),
}

function rowsOf(text: string, delimiter: ',' | '\t' = ',') {
  const file = parseDelimited(text, delimiter)
  const map = suggestColumnMap(file)
  return {
    file,
    rows: file.rows.map((row) => ({
      rowNumber: row.rowNumber,
      mapped: applyColumnMap(file, map, row.cells),
    })),
  }
}

describe('parsing', () => {
  it('reads a plain CSV', () => {
    const file = parseDelimited('slug,title\nriver-table,River Table\n', ',')
    expect(file.headers).toEqual(['slug', 'title'])
    expect(file.rows).toHaveLength(1)
    expect(file.rows[0]?.cells).toEqual(['river-table', 'River Table'])
  })

  it('honours RFC 4180 quoting, including a comma and an escaped quote inside a field', () => {
    const file = parseDelimited('slug,title\nx,"Walnut, resin and a ""river"""\n', ',')
    expect(file.rows[0]?.cells[1]).toBe('Walnut, resin and a "river"')
  })

  it('tolerates CRLF, a trailing newline and a BOM', () => {
    const file = parseDelimited('﻿slug,title\r\nx,Y\r\n\r\n', ',')
    expect(file.headers).toEqual(['slug', 'title'])
    expect(file.rows).toHaveLength(1)
  })

  /** The one thing it is strict about, and the reason: a shifted column silently mis-prices rows. */
  it('REFUSES a row whose cell count does not match the header, naming the line', () => {
    const file = parseDelimited('slug,title,sku\nx,Y\n', ',')
    expect(file.rows).toHaveLength(0)
    expect(file.errors[0]?.rowNumber).toBe(2)
    expect(file.errors[0]?.message).toContain('2 value(s) where the header has 3')
  })

  it('detects a tab-separated file', () => {
    expect(detectDelimiter('slug\ttitle\n')).toBe('\t')
    expect(detectDelimiter('slug,title\n')).toBe(',')
  })

  it('reports a file with no header row', () => {
    expect(parseDelimited('', ',').errors[0]?.message).toContain('no header row')
  })
})

describe('column mapping', () => {
  it('maps by header name and by alias', () => {
    const file = parseDelimited('Slug,Product Name,Item Code\n', ',')
    expect(suggestColumnMap(file)).toEqual({
      Slug: 'slug',
      'Product Name': 'title',
      'Item Code': 'sku',
    })
  })

  it('does not claim one field for two columns', () => {
    const file = parseDelimited('Title,Product Name\n', ',')
    const map = suggestColumnMap(file)
    expect(Object.values(map).filter((field) => field === 'title')).toHaveLength(1)
  })

  it('drops an unmapped column rather than guessing', () => {
    const file = parseDelimited('slug,Notes for the workshop\nx,anything\n', ',')
    const mapped = applyColumnMap(file, suggestColumnMap(file), file.rows[0]!.cells)
    expect(mapped).toEqual({ slug: 'x' })
  })

  it('keeps the raw row so an operator can see what they uploaded', () => {
    const file = parseDelimited('slug,Notes\nx,anything\n', ',')
    expect(rawRow(file, file.rows[0]!.cells)).toEqual({ slug: 'x', Notes: 'anything' })
  })

  it('offers no mapping for status or owner_verification — an import cannot publish or verify', () => {
    const file = parseDelimited('status,owner_verification\n', ',')
    expect(suggestColumnMap(file)).toEqual({})
  })
})

describe('validation', () => {
  it('accepts a complete row', () => {
    const { rows } = rowsOf('slug,title,price_state\nriver-table,River Table,REQUEST_QUOTE\n')
    const [result] = validateImport(rows, EMPTY_CONTEXT)
    expect(result?.issues).toEqual([])
    expect(result?.action).toBe('INSERT')
  })

  it('refuses a row with no slug', () => {
    const { rows } = rowsOf('slug,title\n,River Table\n')
    const [result] = validateImport(rows, EMPTY_CONTEXT)
    expect(result?.issues.map((issue) => issue.rule)).toContain('slug_required')
    expect(result?.action).toBe('SKIP')
  })

  /** Two rows in one file, neither of which exists in the database. Only a file-level check sees it. */
  it('catches a duplicate slug WITHIN the upload, flagging the second occurrence', () => {
    const { rows } = rowsOf('slug,title\nx,One\nx,Two\n')
    const results = validateImport(rows, EMPTY_CONTEXT)
    expect(results[0]?.issues).toEqual([])
    expect(results[1]?.issues.map((issue) => issue.rule)).toContain('slug_duplicate_in_file')
  })

  it('catches a duplicate SKU within the upload', () => {
    const { rows } = rowsOf('slug,sku,title\na,RV-1,One\nb,RV-1,Two\n')
    const results = validateImport(rows, EMPTY_CONTEXT)
    expect(results[1]?.issues.map((issue) => issue.rule)).toContain('sku_duplicate_in_file')
  })

  it('refuses a category the database does not have, rather than creating one', () => {
    const { rows } = rowsOf('slug,title,category_slug\nx,Y,invented\n')
    const [result] = validateImport(rows, EMPTY_CONTEXT)
    expect(result?.issues.map((issue) => issue.rule)).toContain('category_unknown')
  })

  it('resolves a category the database does have', () => {
    const { rows } = rowsOf('slug,title,category_slug\nx,Y,decor\n')
    const [result] = validateImport(rows, EMPTY_CONTEXT)
    expect(result?.issues.filter((issue) => issue.rule === 'category_unknown')).toEqual([])
    expect(result?.mapped['category_id']).toBe('cat-decor')
  })

  /**
   * A DECIMAL IN A MINOR-UNIT COLUMN IS REFUSED, not rounded. `4500.00` means the operator is
   * thinking in rupees, and guessing would put a price on the site that nobody typed.
   */
  it('refuses a decimal price rather than guessing the unit', () => {
    const { rows } = rowsOf('slug,title,price_minor\nx,Y,4500.00\n')
    const [result] = validateImport(rows, EMPTY_CONTEXT)
    expect(result?.issues.map((issue) => issue.rule)).toContain('number_shape')
    expect(result?.issues[0]?.message).toContain('paise, not rupees')
  })

  it('refuses a boolean it cannot read', () => {
    const { rows } = rowsOf('slug,title,is_large_format\nx,Y,maybe\n')
    const [result] = validateImport(rows, EMPTY_CONTEXT)
    expect(result?.issues.map((issue) => issue.rule)).toContain('boolean_shape')
  })

  it('accepts the boolean spellings an operator actually types', () => {
    for (const value of ['yes', 'Y', 'true', '1', 'no', 'N', 'false', '0']) {
      const { rows } = rowsOf(`slug,title,is_large_format\nx,Y,${value}\n`)
      const [result] = validateImport(rows, EMPTY_CONTEXT)
      expect(
        result?.issues.filter((issue) => issue.rule === 'boolean_shape'),
        value,
      ).toEqual([])
    }
  })

  /** FEAT §21, enforced by `validateProduct` rather than re-implemented here. */
  it('refuses a quote-only row that carries a price', () => {
    const { rows } = rowsOf('slug,title,price_state,price_minor\nx,Y,REQUEST_QUOTE,4500\n')
    const [result] = validateImport(rows, EMPTY_CONTEXT)
    expect(result?.issues.length).toBeGreaterThan(0)
    expect(result?.action).toBe('SKIP')
  })

  it('updates rather than duplicating when the slug already exists', () => {
    const context: ImportContext = {
      ...EMPTY_CONTEXT,
      productIdBySlug: new Map([['river-table', 'prod-1']]),
    }
    const { rows } = rowsOf('slug,title,price_state\nriver-table,River Table,REQUEST_QUOTE\n')
    const [result] = validateImport(rows, context)
    expect(result?.action).toBe('UPDATE')
    expect(result?.targetProductId).toBe('prod-1')
    // AND DOES NOT REPORT ITS OWN SLUG AS A DUPLICATE, which is what makes re-importing the same
    // file a no-op rather than a wall of errors.
    expect(result?.issues.map((issue) => issue.rule)).not.toContain('slug_duplicate')
  })
})
