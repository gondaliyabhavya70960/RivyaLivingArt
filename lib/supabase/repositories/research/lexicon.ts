import type { SupabaseClient } from '@supabase/supabase-js'

import { lexiconSchema, type Lexicon } from '@/lib/scraper/normalization'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research material lexicon'

export type LexiconRow = Database['public']['Tables']['research_material_lexicon']['Row']

const LEXICON_COLUMNS =
  'id, token, patterns, family, is_enabled, status, created_at, updated_at, updated_by'

/**
 * The parsing vocabulary, read as data and edited as data.
 *
 * THE POINT OF THE TABLE IS THAT A MATERIAL NOBODY ANTICIPATED IS A STUDIO EDIT AND NOT A DEPLOY.
 * The first time a competitor lists "microcement", the fix should be somebody typing it and running
 * `scripts/research/renormalize.ts` — which re-reads every stored version with NO network traffic at
 * all, because the evidence is already held. A hard-coded array would make that a pull request, a
 * review and a release, so it would not happen and the field would read as unmatched for a year.
 *
 * NOTHING HERE IS A CLAIM ABOUT WHAT RIVYA MAKES. These are words to recognise on somebody else's
 * page, and no token is ever rendered on a public surface.
 */

/** The shape the normalizer takes, parsed. Disabled rows are kept — `prepareLexicon` drops them. */
export async function readLexicon(client: Client): Promise<Lexicon> {
  const { data, error } = await client
    .from('research_material_lexicon')
    .select('token, patterns, family, is_enabled')
    .order('token', { ascending: true })
    .limit(500)
  if (error !== null) throw toRepositoryError(ENTITY, 'read', 'all', error)

  return lexiconSchema.parse(
    (data ?? []).map((row) => ({
      token: row.token,
      patterns: row.patterns,
      family: row.family,
      isEnabled: row.is_enabled,
    })),
  )
}

/** The full rows, for the Studio editor, which shows the audit columns the normalizer ignores. */
export async function listLexicon(client: Client): Promise<readonly LexiconRow[]> {
  const { data, error } = await client
    .from('research_material_lexicon')
    .select(LEXICON_COLUMNS)
    .order('family', { ascending: true, nullsFirst: false })
    .order('token', { ascending: true })
    .limit(500)
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'all', error)
  return (data ?? []) as unknown as LexiconRow[]
}

export async function upsertLexiconEntry(
  client: Client,
  input: {
    readonly id: string | null
    readonly token: string
    readonly patterns: readonly string[]
    readonly family: string | null
    readonly isEnabled: boolean
    readonly userId: string
  },
): Promise<string> {
  const row = {
    token: input.token,
    patterns: [...input.patterns],
    family: input.family,
    is_enabled: input.isEnabled,
    updated_at: new Date().toISOString(),
    updated_by: input.userId,
  }

  if (input.id === null) {
    const { data, error } = await client
      .from('research_material_lexicon')
      .insert(row)
      .select('id')
      .single()
    if (error !== null) throw toRepositoryError(ENTITY, 'create', input.token, error)
    return data.id
  }

  const { data, error } = await client
    .from('research_material_lexicon')
    .update(row)
    .eq('id', input.id)
    .select('id')
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'update', input.id, error)
  return data.id
}

/**
 * Remove a term.
 *
 * A DELETE RATHER THAN A SOFT ONE, AND `is_enabled` IS WHY IT IS SAFE TO OFFER. A term somebody
 * wants to stop matching is DISABLED — the row stays, the history stays, and re-enabling it is one
 * click. Deleting is for a term typed in error, which has no history worth keeping. Offering only
 * the delete would push people towards it for both.
 */
export async function deleteLexiconEntry(client: Client, id: string): Promise<void> {
  const { error } = await client.from('research_material_lexicon').delete().eq('id', id)
  if (error !== null) throw toRepositoryError(ENTITY, 'delete', id, error)
}
