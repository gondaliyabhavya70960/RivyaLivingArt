import 'server-only'

import type { ExportDefinitionRow } from '@/lib/supabase/schemas/sheets'

import { headerRow, validateColumns, type Cell } from '../definitions'
import { SheetsError } from '../errors'
import { directionBriefs } from './direction'
import { inquiries } from './inquiries'
import {
  comparisonSet,
  confirmed,
  opportunityScores,
  researchProducts,
  shortlist,
} from './research'
import { project, type Client, type Record_ } from './shared'

/**
 * One row builder per entity — Phase 36, the half that reads the database.
 *
 * EVERY BUILDER READS THROUGH THE REPOSITORIES AND WRITES NOTHING. A builder is a projection of
 * what a Studio table already shows onto the columns the definition asked for; the column keys
 * are the allowlist's, so a name the allowlist does not declare cannot appear here.
 *
 * ROW LIMITS ARE THE REPOSITORIES' OWN. A spreadsheet tab is not the place for the whole corpus,
 * and a definition that wants a slice says so with its filter.
 *
 * THE BUILDERS ARE SPLIT BY WHAT THEY IMPORT, not by size: `research.ts` carries the one
 * catalogue read (category slugs, A26), `direction.ts` carries the direction repository, and no
 * module carries both (I4). This index imports the builders and no repository.
 */

export interface BuiltRows {
  readonly header: readonly string[]
  readonly rows: readonly (readonly Cell[])[]
}

/** Header and rows for a definition, from the repositories, projected onto its columns. */
export async function buildRows(
  client: Client,
  definition: ExportDefinitionRow,
): Promise<BuiltRows> {
  const validated = validateColumns(definition.entity, definition.columns, definition.includes_pii)
  if (!validated.ok) throw new SheetsError('INVALID_COLUMNS')
  const columns = validated.columns
  const filter = definition.filter

  let records: Record_[]
  switch (definition.entity) {
    case 'RESEARCH_PRODUCTS':
      records = await researchProducts(client, filter)
      break
    case 'COMPARISON_SET':
      records = await comparisonSet(client, definition.scope_id)
      break
    case 'OPPORTUNITY_SCORES':
      records = await opportunityScores(client, filter)
      break
    case 'SHORTLIST':
      records = await shortlist(client, filter)
      break
    case 'CONFIRMED':
      records = await confirmed(client, filter)
      break
    case 'DIRECTION_BRIEFS':
      records = await directionBriefs(client, filter)
      break
    case 'INQUIRIES':
      records = await inquiries(client, filter, definition.includes_pii)
      break
  }

  return { header: headerRow(definition.entity, columns), rows: project(columns, records) }
}
