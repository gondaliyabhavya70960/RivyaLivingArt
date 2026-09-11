import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { withAudit } from '@/lib/auth/audit'
import { roleHasPermission } from '@/lib/auth/permissions'
import type { StaffSession } from '@/lib/auth/session'
import type { Database } from '@/lib/supabase/database.types'
import {
  insertRedirect,
  listRedirects,
  updateRedirect,
} from '@/lib/supabase/repositories/redirects'

import { validateRedirect } from './redirect-rules'

type Client = SupabaseClient<Database>

/**
 * The redirect a slug change leaves behind — Phase 39.
 *
 * CALLED AFTER THE ENTITY SAVED, NEVER BEFORE. The product's new address exists by the time this
 * runs; a redirect written first would point at a page that did not yet exist if the save then
 * failed. The redirect's failure, in turn, never fails the save: the product has moved, and a
 * missing redirect is a fixable gap in the Redirects tab, whereas a rolled-back rename would be a
 * mystery.
 *
 * A ROW FROM THE NEW ADDRESS BACK IS RETARGETED, NOT LEFT TO LOOP. Renaming `a` → `b` when a
 * redirect `b` → `a` already exists (the owner renamed it back) would form a loop; the rule set
 * refuses that, so the existing row is updated to point at the new address instead of inserting.
 * Any other refusal — a chain through a third address — is left for a person, and reported in
 * the audit row rather than thrown.
 *
 * `seo.write` IS CHECKED HERE, SEPARATELY. The caller holds `catalog.write`; writing a redirect is
 * a different act under a different permission, and a merchandiser without it saves the product
 * and gets no redirect — recorded, not refused.
 */
export async function redirectForSlugChange(
  client: Client,
  session: StaffSession,
  change: {
    readonly entityType: string
    readonly entityId: string
    readonly fromPath: string
    readonly toPath: string
  },
): Promise<void> {
  if (!roleHasPermission(session.role, 'seo.write')) return
  if (change.fromPath === change.toPath) return

  try {
    const existing = await listRedirects(client)
    const reverse = existing.find(
      (row) => row.from_path === change.toPath && row.to_path === change.fromPath,
    )
    const values = {
      from_path: change.fromPath,
      to_path: change.toPath,
      status_code: 308 as const,
      reason: `Address changed in Studio (${change.entityType})`,
    }
    if (reverse !== undefined) {
      // The owner renamed it back: the old row already points at what is now the old address.
      // Flip it rather than add a second row that would loop with it.
      await withAudit(
        {
          action: 'seo.redirect.update',
          actorUserId: session.userId,
          actorRole: session.role,
          entityType: 'seo_redirects',
          entityId: reverse.id,
          summary: `Retargeted redirect ${reverse.from_path} after the address changed back`,
          after: values,
        },
        async () => updateRedirect(client, reverse.id, values, session.userId),
      )
      return
    }
    const verdict = validateRedirect(existing, values)
    if (!verdict.ok) return
    await withAudit(
      {
        action: 'seo.redirect.create',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'seo_redirects',
        summary: `Redirect ${change.fromPath} → ${change.toPath} after a slug change`,
        after: values,
      },
      async () => insertRedirect(client, values, session.userId),
    )
  } catch {
    // The product is saved; a redirect that could not be written is a gap the Redirects tab shows.
  }
}
