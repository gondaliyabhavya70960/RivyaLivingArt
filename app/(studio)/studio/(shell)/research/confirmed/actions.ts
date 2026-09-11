'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { writeAudit } from '@/lib/auth/audit'
import { requirePermission } from '@/lib/auth/require'
import { isEnabled } from '@/lib/flags'
import { logActivity } from '@/lib/logging/activity'
import { BRIDGE_SLUG, emptyDraftForBridge } from '@/lib/scraper/workflows/bridge-draft'
import { createAdminClient } from '@/lib/supabase/admin'
import { ConflictError } from '@/lib/supabase/errors'
import { insertProduct } from '@/lib/supabase/repositories/catalog-admin'
import {
  getConfirmationForBridge,
  markProductStarted,
  releaseProductStart,
} from '@/lib/supabase/repositories/research/shortlist'
import { createClient } from '@/lib/supabase/server'

/**
 * THE ONE BRIDGE — Phase 35's `startProductFromConfirmation`, and the only symbol in the
 * repository that writes `products` while importing a research repository.
 *
 * WHAT IT READS FROM RESEARCH: `getConfirmationForBridge(id)` → `{ id, stage, archived_at }`.
 * Three fields, none of them competitor text. There is no title, price, dimension, material,
 * description or image in scope to copy, which is a stronger guarantee than a promise not to.
 *
 * WHAT IT WRITES TO THE CATALOGUE: `slug` (typed by the person), `title` (the slug's title case,
 * a placeholder), `category_id` (chosen by the person), `status = 'DRAFT'`,
 * `price_state = 'PRICE_ON_REQUEST'`. Nothing else — see `lib/scraper/workflows/bridge-draft.ts`
 * and `tests/unit/confirmation-no-import.test.ts`.
 *
 * WHAT IT REQUIRES, ALL OF IT: the `research_product_bridge` flag on (off until the owner accepts
 * amendment A35); `catalog.write`; a confirmed row with a live decision; a slug and a category;
 * and the seeded acknowledgement ticked. A direct POST missing any of those is refused with the
 * reason — the disabled button on the screen is a courtesy, not the gate.
 *
 * THE CARVE-OUT IS ENFORCED, NOT TRUSTED. `scripts/research/check-research-isolation.mjs` (I4)
 * fails the build on a second such writer, on this symbol defined anywhere else, and on this file
 * importing any research reader beyond `getConfirmationForBridge`; `check-no-autoimport.mjs`
 * admits `insertProduct` in this file and no other first-party write anywhere in research.
 */

export type BridgeState =
  | { readonly status: 'idle' }
  | { readonly status: 'error'; readonly code: string; readonly message: string }
  | { readonly status: 'started'; readonly productId: string; readonly slug: string }

const bridgeForm = z
  .object({
    confirmation_id: z.string().uuid(),
    slug: z.string().trim().min(3).max(80).regex(BRIDGE_SLUG),
    category_id: z.string().uuid(),
    acknowledged: z.literal('yes'),
  })
  .strict()

const refused = (code: string, message: string): BridgeState => ({ status: 'error', code, message })

export async function startProductFromConfirmation(
  _previous: BridgeState,
  form: FormData,
): Promise<BridgeState> {
  const session = await requirePermission('catalog.write')

  if (!(await isEnabled('research_product_bridge'))) {
    return refused(
      'flag_off',
      'The research product bridge is switched off (research_product_bridge). It stays off until the owner accepts amendment A35.',
    )
  }

  const raw = {
    confirmation_id: form.get('confirmation_id'),
    slug: form.get('slug'),
    category_id: form.get('category_id'),
    acknowledged: form.get('acknowledged'),
  }
  if (raw.acknowledged !== 'yes') {
    return refused('acknowledgement', 'Tick the acknowledgement before creating the draft.')
  }
  const parsed = bridgeForm.safeParse(raw)
  if (!parsed.success) {
    return refused(
      'invalid',
      'Type a slug (lower-case words joined by hyphens) and choose a category.',
    )
  }

  const client = await createClient()
  const target = await getConfirmationForBridge(client, parsed.data.confirmation_id)
  if (target === null || target.stage !== 'CONFIRMED' || target.archived_at !== null) {
    return refused(
      'not_confirmed',
      'Only a confirmed row with a live decision can start a product.',
    )
  }

  const admin = createAdminClient()
  const draft = emptyDraftForBridge({ slug: parsed.data.slug, categoryId: parsed.data.category_id })
  const productId = crypto.randomUUID()

  // THE CLAIM COMES FIRST. The confirmation is marked with the id the product will carry, and only
  // where nothing was started before — so a double click, or two people on the same row, starts
  // one product and not two. A failed insert gives the claim back.
  const claimed = await markProductStarted(admin, {
    confirmationId: target.id,
    productId,
    actorUserId: session.userId,
  })
  if (!claimed)
    return refused('already_started', 'A product was already started from this decision.')

  try {
    await insertProduct(admin, { id: productId, ...draft, updated_by: session.userId })
  } catch (error) {
    await releaseProductStart(admin, { confirmationId: target.id, productId })
    if (error instanceof ConflictError) {
      return refused('slug_taken', 'That slug is already in use. Choose another.')
    }
    throw error
  }

  await writeAudit({
    action: 'research.product.started',
    result: 'SUCCESS',
    actorUserId: session.userId,
    actorRole: session.role,
    entityType: 'product',
    entityId: productId,
    summary: `Empty draft ${draft.slug} started from research decision ${target.id}. No competitor field copied.`,
  })
  await logActivity({
    action: 'research.product.started',
    actorId: session.userId,
    actorRole: session.role,
    entityType: 'product',
    entityId: productId,
    entityLabel: draft.slug,
    summary: 'Empty draft product started by hand from a confirmed research row.',
    metadata: { confirmationId: target.id, fields: Object.keys(draft) },
  })

  revalidatePath('/studio/research/confirmed')
  revalidatePath('/studio/catalog/products')

  return { status: 'started', productId, slug: draft.slug }
}
