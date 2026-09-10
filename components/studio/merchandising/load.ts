import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { resolveSlot, type ResolvedSlot } from '@/lib/cms/merchandising'
import type { Database } from '@/lib/supabase/database.types'
import {
  listCategoriesForStudio,
  listCollectionsForStudio,
  listProductsForStudio,
} from '@/lib/supabase/repositories/catalog-admin'
import { listArticlesForStudio } from '@/lib/supabase/repositories/journal'
import { listEntries } from '@/lib/supabase/repositories/merchandising'
import { createPublicClient } from '@/lib/supabase/public'
import type { MerchandisingEntry, MerchandisingSlot } from '@/lib/supabase/schemas'

import type { Candidate, EntryLabel } from './SlotEditor'

type Client = SupabaseClient<Database>
type EntityType = MerchandisingSlot['allowed_entity_types'][number]

/**
 * What the three editing screens load for the slots they own — once per screen, not once per
 * slot, so a screen with seven pinned slots reads the product list once.
 *
 * LABELS COME FROM EVERY ROW THE SESSION MAY SEE; CANDIDATES FROM THE PUBLISHED ONES. An entry
 * pointing at a draft product must still be NAMED in the table (it is there, and the editor should
 * see what it is), while the picker offers only what the resolver would actually render. Concept
 * collections are withheld from the picker and reported, so the screen can say why they are absent.
 */
export type EntityLists = {
  readonly labels: ReadonlyMap<string, EntryLabel>
  readonly candidates: readonly Candidate[]
  readonly conceptsWithheld: boolean
}

export async function loadEntityLists(
  client: Client,
  types: readonly EntityType[],
): Promise<EntityLists> {
  const wanted = new Set<EntityType>(types)
  const labels = new Map<string, EntryLabel>()
  const candidates: Candidate[] = []
  let conceptsWithheld = false

  if (wanted.has('PRODUCT')) {
    for (const product of await listProductsForStudio(client, {}, 500)) {
      const title = product.title ?? product.slug
      labels.set(`PRODUCT:${product.id}`, { title, status: product.status })
      if (product.status === 'PUBLISHED')
        candidates.push({ type: 'PRODUCT', id: product.id, label: title })
    }
  }
  if (wanted.has('COLLECTION')) {
    for (const collection of await listCollectionsForStudio(client)) {
      labels.set(`COLLECTION:${collection.id}`, {
        title: collection.name,
        status: collection.status,
      })
      if (collection.concept_state !== 'OWNER_CONFIRMED') {
        conceptsWithheld = true
        continue
      }
      if (collection.status === 'PUBLISHED') {
        candidates.push({ type: 'COLLECTION', id: collection.id, label: collection.name })
      }
    }
  }
  if (wanted.has('CATEGORY')) {
    for (const category of await listCategoriesForStudio(client)) {
      labels.set(`CATEGORY:${category.id}`, { title: category.name, status: category.status })
      if (category.status === 'PUBLISHED') {
        candidates.push({ type: 'CATEGORY', id: category.id, label: category.name })
      }
    }
  }
  if (wanted.has('JOURNAL_ARTICLE')) {
    for (const article of await listArticlesForStudio(client)) {
      labels.set(`JOURNAL_ARTICLE:${article.id}`, { title: article.title, status: article.status })
      if (article.status === 'PUBLISHED') {
        candidates.push({ type: 'JOURNAL_ARTICLE', id: article.id, label: article.title })
      }
    }
  }

  return { labels, candidates, conceptsWithheld }
}

export type LoadedSlot = {
  readonly slot: MerchandisingSlot
  readonly entries: readonly MerchandisingEntry[]
  readonly preview: ResolvedSlot
}

/** A slot's entries as staff see them, and its public answer as the resolver gives it. */
export async function loadSlot(client: Client, slot: MerchandisingSlot): Promise<LoadedSlot> {
  const [entries, preview] = await Promise.all([
    listEntries(client, slot.id),
    resolveSlot(createPublicClient(), slot.key),
  ])
  return { slot, entries, preview }
}
