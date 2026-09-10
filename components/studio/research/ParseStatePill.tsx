import { Badge } from '@/components/primitives/Badge'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'

/**
 * How a value that Rivya could not read is drawn.
 *
 * "NOT READ" RATHER THAN AN EM DASH, AND THAT IS THE WHOLE COMPONENT. A blank cell in a table of
 * competitor data reads as "the page did not say", and the difference between that and "the page
 * said something we could not parse" is the difference between a competitor who publishes no
 * measurements and a parser that needs fixing. Four states, four words, and every screen in this
 * phase uses this one so they cannot drift apart.
 *
 * AMBIGUOUS IS A WARNING AND UNPARSED IS NOT AN ERROR. An ambiguous value is one somebody should
 * look at — a `$` nobody could attribute, a number with no unit — and an unparsed one is usually a
 * page that wrote prose. Drawing both in red would make the tone meaningless within a week.
 */
export function ParseStatePill({ state }: { readonly state: string | null }) {
  if (state === null || state === 'PARSED') return null

  if (state === 'ABSENT') {
    return (
      <Text as="span" size="xs" tone="tertiary" data-parse-state="ABSENT">
        {t('studio.research.notMentioned')}
      </Text>
    )
  }

  return state === 'AMBIGUOUS' ? (
    <Badge tone="warning" data-parse-state="AMBIGUOUS">
      {t('studio.research.ambiguous')}
    </Badge>
  ) : (
    <Badge tone="neutral" data-parse-state="UNPARSED">
      {t('studio.research.notRead')}
    </Badge>
  )
}

/**
 * A price, as this system is allowed to state one.
 *
 * THE CURRENCY IS ALWAYS BESIDE THE NUMBER AND IS NEVER CONVERTED. A bare "1,299" in a table that
 * also holds euros and rupees is the first step towards somebody comparing them; the code is not
 * decoration. A quote-only posture prints its posture and no number, which is the same claim the
 * database constraint makes.
 */
export function formatMinor(minor: number | null, currency: string | null): string | null {
  if (minor === null || currency === null) return null
  // TWO DECIMAL PLACES UNCONDITIONALLY WOULD BE WRONG FOR YEN. `minorUnitExponent` is the
  // normalizer's own table and this is a display of what it stored, so the same exponent governs.
  const exponent = ZERO_DECIMAL.has(currency) ? 0 : THREE_DECIMAL.has(currency) ? 3 : 2
  const value = minor / 10 ** exponent
  return `${currency} ${value.toFixed(exponent)}`
}

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'XAF', 'XOF', 'XPF', 'PYG'])
const THREE_DECIMAL = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'])
