import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { EnvironmentChecks } from '@/components/studio/ops/EnvironmentChecks'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { readBuildInfo, shortSha } from '@/lib/ops/build-info'
import { runEnvironmentChecks, worstStatus } from '@/lib/ops/environment'

/**
 * `/studio/system/environment` — Phase 38. Eight reachability checks, run server-side in parallel
 * under a three-second timeout each, rendered as status, code, latency, checked-at and identifiers.
 * THE PAGE SHOWS NO VALUE, PREFIX, LENGTH OR HASH OF ANY VARIABLE: `configured` is presence
 * collapsed to a boolean, an upstream message is mapped to a code, and every result passes the
 * redactor. It offers no "fix it" action, and it says on its face that it is not a functional test.
 */
export const metadata = studioMetadata('/studio/system/environment')
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requirePermission('system.environment.read')
  const results = await runEnvironmentChecks()
  const overall = worstStatus(results)
  const build = readBuildInfo()

  return (
    <StudioPage path="/studio/system/environment">
      <Stack gap={5}>
        <Surface level={1} className="p-4" data-env-banner="">
          <Stack gap={2}>
            <div className="flex flex-wrap items-center gap-2">
              <Text size="sm">{t('studio.env.overall')}</Text>
              <Badge
                tone={
                  overall === 'OK' ? 'success' : overall === 'UNREACHABLE' ? 'danger' : 'warning'
                }
                data-env-overall={overall}
              >
                {overall}
              </Badge>
            </div>
            <Text size="sm" data-env-reachability-note="">
              {t('studio.env.reachabilityNote')}
            </Text>
            <Text size="xs" tone="secondary">
              {t('studio.env.notFunctionalTest')}
            </Text>
          </Stack>
        </Surface>

        <EnvironmentChecks results={results} />

        <Surface level={1} className="p-4" data-env-build="">
          <Stack gap={1}>
            <Text size="2xs" uppercase tone="tertiary">
              {t('studio.env.buildHeading')}
            </Text>
            <Text size="sm">{`${t('studio.env.buildCommit')} ${shortSha(build.sha)} · ${t('studio.env.buildBranch')} ${build.branch}`}</Text>
            <Text size="xs" tone="secondary">
              {`${t('studio.env.buildAt')} ${build.builtAt} · ${t('studio.env.buildEnvironment')} ${build.environment} · ${t('studio.env.buildMigrations')} ${String(build.migrationsOnDisk)} (${build.latestMigrationFile ?? 'none'})`}
            </Text>
          </Stack>
        </Surface>
      </Stack>
    </StudioPage>
  )
}
