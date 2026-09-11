import { Badge, type BadgeTone } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { t, type StudioStringKey } from '@/components/studio/strings'
import type { PostureState, SecurityPosture } from '@/lib/ops/security-posture'

/**
 * The Security section of `/studio/system/environment` — Phase 41, RC-356.
 *
 * STATE ONLY, and the phase document's word for it is the right one. Every row is a badge and a
 * sentence: whether the policy is enforced or collecting, whether a name is set. There is no value
 * on this surface and no way to add one — `readSecurityPosture()` returns booleans and counts, so
 * a careless edit here has nothing to leak.
 *
 * NO ACTION, DELIBERATELY. Enforcing the policy is an environment-variable change followed by a
 * deploy, and a button here that appeared to do it would be a button that lies about where the
 * state lives. The page names the variable; the dashboard owns it.
 *
 * THE EXCEPTIONS ARE LISTED BECAUSE THEY ARE THE POLICY'S WEAK POINTS. A content security policy
 * described only by "enforced" invites the reading that nothing can get through it. Two directives
 * are relaxed and both are named here, so whoever reads this page after an incident knows where to
 * look first.
 */

const TONE: Record<PostureState, BadgeTone> = {
  ENFORCED: 'success',
  // Not a warning. Report-only is the documented shipping posture until the soak is done, and a
  // yellow badge on the intended state teaches people to ignore yellow badges.
  REPORT_ONLY: 'info',
  CONFIGURED: 'success',
  // A missing salt is not cosmetic: the hashes it keys stop being unguessable. Danger is honest.
  NOT_CONFIGURED: 'danger',
}

const LABEL: Record<string, StudioStringKey> = {
  csp: 'studio.security.rowCsp',
  ipHashSalt: 'studio.security.rowIpHashSalt',
  rateLimitSalt: 'studio.security.rowRateLimitSalt',
  cronSecret: 'studio.security.rowCronSecret',
}

export function SecurityPostureSection({
  posture,
}: {
  readonly posture: SecurityPosture
}): React.ReactElement {
  return (
    <Surface level={1} className="p-4" data-security-posture="">
      <Stack gap={3}>
        <Stack gap={1}>
          <Text size="2xs" uppercase tone="tertiary">
            {t('studio.security.heading')}
          </Text>
          <Text size="xs" tone="secondary">
            {t('studio.security.note')}
          </Text>
        </Stack>

        <dl className="m-0 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2">
          {posture.rows.map((row) => {
            const label = LABEL[row.key]
            if (label === undefined) return null
            return (
              <div key={row.key} className="contents">
                <dt className="text-sm">{t(label)}</dt>
                <dd className="m-0 justify-self-end">
                  <Badge tone={TONE[row.state]} data-security-row={row.key}>
                    {row.state}
                  </Badge>
                </dd>
              </div>
            )
          })}
        </dl>

        <Stack gap={1}>
          <Text size="xs" tone="secondary" data-security-header-name="">
            {`${t('studio.security.headerInUse')} ${posture.cspHeader}`}
          </Text>
          <Text size="xs" tone="secondary">
            {`${t('studio.security.headersApplied')} ${posture.headerNames.join(', ')}`}
          </Text>
          <Text size="xs" tone="secondary">
            {`${t('studio.security.exceptions')} ${posture.exceptions.join('; ')}`}
          </Text>
          <Text size="xs" tone="secondary">
            {`${t('studio.security.rateLimits')} ${String(posture.rateLimitedSurfaces)} · ${t('studio.security.tightestWindow')} ${String(posture.tightestWindowSeconds)}s`}
          </Text>
        </Stack>
      </Stack>
    </Surface>
  )
}
