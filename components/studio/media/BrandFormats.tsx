import { Badge } from '@/components/primitives/Badge'
import { Heading } from '@/components/primitives/Heading'
import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import { BRAND_SLOTS, type BrandSlot } from '@/lib/media/validate-upload'

/**
 * THE FOUR BRAND ASSETS THE OWNER OWES, AND THE FORMAT EACH MUST ARRIVE IN — Phase 43, RC-361.
 *
 * WHY THIS IS A PANEL AND NOT A VALIDATOR MESSAGE. A logo, a wordmark and a favicon are the exact
 * files a designer hands over as SVG, and Phase 41 refuses SVG on every upload path without
 * exception. Telling somebody that AFTER they have picked a file is how a rejection reads as a bug;
 * telling them before is how it reads as a requirement. The formats come from `BRAND_SLOTS` — the
 * same table the validator enforces — so the panel cannot promise something the upload would refuse.
 *
 * THEY ARE NOT GENERATED, AND THE REASON IS NOT TECHNICAL. A mark is an organisation's identity: an
 * AI-generated logo presented as Rivya's would be a fabricated fact about the business (D10) with
 * unresolved provenance attached. So all four are `OWNER_VERIFICATION_REQUIRED` permanently, and
 * the interim is a typographic wordmark built from design tokens — no image request at all.
 *
 * `supplied` IS COUNTED FROM REAL ROWS rather than assumed. A panel that always said "outstanding"
 * would keep saying it after the owner had done the work.
 */

const ORDER: readonly BrandSlot[] = ['logo', 'wordmark', 'favicon', 'og']

const LABEL: Record<BrandSlot, string> = {
  logo: 'Logo',
  wordmark: 'Wordmark',
  favicon: 'Favicon',
  og: 'Default social image',
}

/**
 * Which slot an existing BRAND asset satisfies, by its public id.
 *
 * MATCHED ON THE PUBLIC ID because that is what the owner controls when they upload — there is no
 * `brand_slot` column, and adding one to hold four rows would be a migration in service of a
 * filename convention. A public id containing "logo" is the owner having named their logo.
 */
export function slotOf(publicId: string): BrandSlot | null {
  const name = publicId.toLowerCase()
  if (name.includes('wordmark')) return 'wordmark'
  if (name.includes('favicon') || name.includes('icon')) return 'favicon'
  if (name.includes('og') || name.includes('social')) return 'og'
  if (name.includes('logo') || name.includes('mark')) return 'logo'
  return null
}

export function BrandFormats({
  supplied,
}: {
  /** The public ids of every BRAND asset already in the library. */
  readonly supplied: readonly string[]
}) {
  const filled = new Set(supplied.map(slotOf).filter((slot): slot is BrandSlot => slot !== null))

  return (
    <Surface level={1} className="p-4" data-brand-formats="">
      <Stack gap={3}>
        <Stack gap={1}>
          <Heading level={2} size="display-xs">
            {t('studio.media.brand.formatsHeading')}
          </Heading>
          <HelpText>{t('studio.media.brand.formatsBody')}</HelpText>
        </Stack>

        <dl className="m-0 grid grid-cols-[1fr_auto] items-start gap-x-6 gap-y-3">
          {ORDER.map((slot) => (
            <div key={slot} className="contents">
              <dt>
                <Stack gap={1}>
                  <Text size="sm">{LABEL[slot]}</Text>
                  <Text size="sm" tone="secondary">
                    {BRAND_SLOTS[slot].describe}
                  </Text>
                </Stack>
              </dt>
              <dd className="m-0 justify-self-end">
                <Badge tone={filled.has(slot) ? 'success' : 'warning'} data-brand-slot={slot}>
                  {filled.has(slot)
                    ? t('studio.media.brand.supplied')
                    : t('studio.media.brand.outstanding')}
                </Badge>
              </dd>
            </div>
          ))}
        </dl>

        <Text size="xs" tone="secondary">
          {t('studio.media.brand.interim')}
        </Text>
      </Stack>
    </Surface>
  )
}
