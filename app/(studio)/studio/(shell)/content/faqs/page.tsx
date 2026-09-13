import { HelpText } from '@/components/primitives/HelpText'
import { Text } from '@/components/primitives/Text'
import { DataTable } from '@/components/studio/DataTable'
import { ListPage } from '@/components/studio/ListPage'
import { StatusPill, VerificationPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { listFaqs } from '@/lib/supabase/repositories/cms'
import { createClient } from '@/lib/supabase/server'
import type { Faq } from '@/lib/supabase/schemas'

/**
 * /studio/content/faqs — the register of answers waiting to be confirmed.
 *
 * IT WAS A TWENTY-LINE STUB UNTIL PHASE D, and the reason it stayed one is worth recording because
 * it was wrong: Phase B's note said no FAQ reader existed. `listFaqs` has been in
 * `lib/supabase/repositories/cms.ts` since the CMS engine landed. The screen needed writing; the
 * data layer did not.
 *
 * §8 GIVES IT ONE JOB — "Verify answers" — AND THAT IS NOT THE SAME AS WRITING THEM. A54 seeded
 * fifty-five, every one a DRAFT carrying `owner_verification`, because each states something about
 * how this studio works and D10 forbids the interface asserting that on the owner's behalf. The
 * work in front of anybody opening this screen is reading those fifty-five, not adding a fifty-
 * sixth. So there is no create form here and the verification column is the point of the table.
 *
 * NO PUBLISH CONTROL EITHER, AND THAT IS A SCOPE LINE RATHER THAN AN OVERSIGHT. Publishing a row
 * that carries `OWNER_VERIFICATION_REQUIRED` is refused in the database, and the Studio's answer to
 * that refusal belongs on an editing screen with the permission checks and the transition rules
 * that go with it. A one-click publish on a list row would be a control whose most likely outcome
 * is a server error the reader cannot interpret.
 *
 * ORDERED BY `position`, WHICH IS HOW THE PUBLIC PAGE ORDERS THEM. A verifier reading down this
 * list is reading them in the sequence a visitor would, which is the sequence in which a wrong
 * answer does its damage.
 *
 * READS THROUGH THE REQUEST-SCOPED CLIENT, so the list is exactly what this role may see.
 */
export const metadata = studioMetadata('/studio/content/faqs')

export default async function Page() {
  await requirePermission('content.read')

  /*
   * A FAILED READ IS NOT AN EMPTY LIST. `listFaqs` throws on a PostgREST error rather than
   * returning `[]`, and rendering "No questions yet" from a caught throw would tell an owner their
   * fifty-five seeded drafts had vanished. `EmptyState`'s third reason exists for exactly this.
   */
  let faqs: Faq[] | null = null
  try {
    faqs = await listFaqs(await createClient())
  } catch {
    faqs = null
  }

  return (
    <StudioPage path="/studio/content/faqs">
      <ListPage purpose={t('studio.faqs.purpose')}>
        <DataTable<Faq>
          caption={t('studio.faqs.caption')}
          rows={faqs ?? []}
          rowKey={(faq) => faq.id}
          empty={
            faqs === null
              ? {
                  reason: 'unreadable',
                  heading: t('studio.faqs.unreadableHeading'),
                  body: t('studio.faqs.unreadableBody'),
                }
              : {
                  reason: 'empty',
                  heading: t('studio.faqs.emptyHeading'),
                  body: t('studio.faqs.emptyBody'),
                  // No CTA: there is nowhere to send anyone. `EmptyState` would render one happily,
                  // and a button pointing at a screen that does not exist is worse than no button.
                }
          }
          columns={[
            {
              id: 'position',
              header: t('studio.faqs.colPosition'),
              numeric: true,
              cell: (faq) => faq.position,
            },
            {
              id: 'question',
              header: t('studio.faqs.colQuestion'),
              // NOT A LINK. Every other Studio list makes its first column the way in; this one has
              // no detail screen to go to, and a link that goes nowhere teaches a reader the whole
              // table is inert.
              cell: (faq) =>
                faq.question === '' ? (
                  <Text as="span" size="sm" tone="tertiary">
                    {t('studio.faqs.untitled')}
                  </Text>
                ) : (
                  faq.question
                ),
            },
            {
              id: 'category',
              header: t('studio.faqs.colCategory'),
              cell: (faq) =>
                faq.category === null || faq.category === ''
                  ? t('studio.faqs.noCategory')
                  : faq.category,
            },
            {
              id: 'status',
              header: t('studio.faqs.colStatus'),
              /*
               * BOTH PILLS, AND THE SECOND ONE IS THE REASON THIS SCREEN EXISTS. The status says
               * DRAFT; the verification says whether it is a draft because nobody has written it or
               * a draft because nobody has confirmed it. Only the second is work for the owner, and
               * without the pill the two are indistinguishable across fifty-five rows.
               */
              cell: (faq) => (
                <span className="flex flex-wrap items-center gap-1">
                  <StatusPill status={faq.status} />
                  <VerificationPill verification={faq.owner_verification} />
                </span>
              ),
            },
          ]}
        />

        <HelpText>{t('studio.faqs.verifyNote')}</HelpText>
      </ListPage>
    </StudioPage>
  )
}
