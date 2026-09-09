import { Badge, type BadgeTone } from '@/components/primitives/Badge'
import type { Database } from '@/lib/supabase/database.types'

type ContentStatus = Database['public']['Enums']['content_status']
type OwnerVerification = Database['public']['Enums']['owner_verification']

/**
 * The two enums a reader has to be able to tell apart at a glance.
 *
 * COLOUR IS NEVER THE ONLY SIGNAL. Each pill renders its own word as well as its tone, so the
 * distinction survives greyscale, colour blindness and a printed page (WCAG 1.4.1). That is why
 * these are `Badge` with a label rather than a coloured dot.
 *
 * THE MAPPINGS ARE JUDGEMENTS, NOT DECORATION, and the two that matter are:
 *
 * `OWNER_VERIFICATION_REQUIRED` is **warning**, not neutral. It is the D10 gate: a row carrying it
 * cannot be published, and its whole purpose is to stop a fabricated business fact reaching a
 * public surface. Rendering it as quiet grey would make the one state an owner must act on the
 * least visible thing on the screen.
 *
 * `ARCHIVED` is neutral rather than danger. Archiving is a normal, reversible editorial act; red
 * would read as an error and make people avoid a safe operation.
 */
const STATUS_TONE: Record<ContentStatus, BadgeTone> = {
  DRAFT: 'neutral',
  REVIEW: 'info',
  APPROVED: 'info',
  PUBLISHED: 'success',
  ARCHIVED: 'neutral',
}

const VERIFICATION_TONE: Record<OwnerVerification, BadgeTone> = {
  NOT_REQUIRED: 'neutral',
  OWNER_VERIFICATION_REQUIRED: 'warning',
  VERIFIED: 'success',
}

/**
 * Labels are the enum value, humanised.
 *
 * Deliberately NOT routed through `components/studio/strings.ts`. These name database states rather
 * than addressing a reader, and an editor renaming "PUBLISHED" to something friendlier would break
 * the correspondence between what the Studio shows and what a `psql` session shows — which is the
 * thing anyone debugging a publication problem relies on.
 */
function humanise(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, ' ')
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export function StatusPill({ status }: { status: ContentStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{humanise(status)}</Badge>
}

export function VerificationPill({ verification }: { verification: OwnerVerification }) {
  // NOT_REQUIRED is the common, uninteresting case; a pill for it is noise on every row.
  if (verification === 'NOT_REQUIRED') return null
  return <Badge tone={VERIFICATION_TONE[verification]}>{humanise(verification)}</Badge>
}

/**
 * The demo badge. Rendered wherever a row that can be placeholder is listed.
 *
 * WARNING TONE, THE SAME AS THE VERIFICATION GATE, and for a related reason: both mark a row that
 * must not be mistaken for settled truth. A demo product looks exactly like a real one on the public
 * site — deliberately, because a placeholder catalogue that behaved differently would tell the owner
 * nothing about the site they are evaluating — so the Studio is the only place the difference is
 * visible, and it has to be visible at a glance rather than on a detail screen.
 *
 * It renders NOTHING for a real row. `docs/content/DEMO_CONTENT.md` is the register and
 * `npm run demo:purge` is the removal; this is the reminder, on every row, that both exist.
 */
export function DemoPill({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) return null
  return <Badge tone="warning">Demo</Badge>
}
