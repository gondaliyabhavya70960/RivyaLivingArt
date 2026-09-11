import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import type { BuildInfo } from '@/lib/ops/build-info'
import { shortSha } from '@/lib/ops/build-info'

/**
 * WHAT IS ACTUALLY DEPLOYED HERE — Phase 44, RC-363.
 *
 * THE QUESTION IT ANSWERS IS "IS MY FIX LIVE". Somebody merges a change, waits, and cannot tell
 * whether the page they are looking at is the new build or a cached old one. A commit SHA on the
 * page answers it in one glance and is checkable against `git rev-parse HEAD`.
 *
 * IDENTIFIERS ONLY, AND THE DISTINCTION IS D8'S. A commit SHA, a branch name, a build time, an
 * environment name and a count of migration files are identifiers: they name things, and knowing
 * them grants nothing. A variable's VALUE, its prefix, its length or a hash of it is the other
 * category, and none appears here or anywhere on this page.
 *
 * IT REPLACES AN INLINE BLOCK ON THE PAGE rather than adding a second one. Phase 38 rendered the
 * same five facts as three lines of `Text` inside `/studio/system/environment`; Phase 44's phase
 * document asks for a component, and the reason to make one is the migration-state row — a
 * comparison with a tone, which is a thing that wants its own place to live rather than a fourth
 * template literal.
 *
 * THE MIGRATION ROW IS THE ONE THAT CAN BE WRONG, and it is the point of the panel. `BEHIND` means
 * the database has fewer migrations than this build's files: code is deployed that expects a schema
 * nobody applied. `AHEAD` means the reverse — a migration was applied and the code that uses it was
 * not promoted, which is the SAFE half of the expand/contract window and reads as `info` rather
 * than as a warning.
 */

export interface BuildPanelProps {
  readonly build: BuildInfo
  /**
   * How many migrations the DATABASE records, when it could be read.
   *
   * Null when the check could not run — an unreachable database is not a migration mismatch, and
   * reporting one would send somebody to look at the wrong thing.
   */
  readonly appliedMigrations: number | null
}

type MigrationState = 'LEVEL' | 'BEHIND' | 'AHEAD' | 'UNKNOWN'

export function migrationState(onDisk: number, applied: number | null): MigrationState {
  if (applied === null) return 'UNKNOWN'
  if (applied === onDisk) return 'LEVEL'
  return applied < onDisk ? 'BEHIND' : 'AHEAD'
}

const TONE = {
  LEVEL: 'success',
  // A warning rather than danger: the site is running, and the fix is to run one workflow.
  BEHIND: 'warning',
  // The safe half of an expand/contract window — this is what a correct deploy looks like mid-flight.
  AHEAD: 'info',
  UNKNOWN: 'neutral',
} as const

export function BuildPanel({ build, appliedMigrations }: BuildPanelProps): React.ReactElement {
  const state = migrationState(build.migrationsOnDisk, appliedMigrations)

  return (
    <Surface level={1} className="p-4" data-build-panel="">
      <Stack gap={3}>
        <Text size="2xs" uppercase tone="tertiary">
          {t('studio.env.buildHeading')}
        </Text>

        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-ink-secondary">{t('studio.env.buildCommit')}</dt>
          <dd className="m-0 font-mono" data-build-sha="">
            {shortSha(build.sha)}
          </dd>

          <dt className="text-ink-secondary">{t('studio.env.buildBranch')}</dt>
          <dd className="m-0">{build.branch}</dd>

          <dt className="text-ink-secondary">{t('studio.env.buildAt')}</dt>
          <dd className="m-0">{build.builtAt}</dd>

          <dt className="text-ink-secondary">{t('studio.env.buildEnvironment')}</dt>
          <dd className="m-0" data-build-environment={build.environment}>
            {build.environment}
          </dd>

          <dt className="text-ink-secondary">{t('studio.env.buildMigrations')}</dt>
          <dd className="m-0">
            <span className="mr-2">
              {`${String(build.migrationsOnDisk)} on disk · ${appliedMigrations === null ? '—' : String(appliedMigrations)} applied`}
            </span>
            <Badge tone={TONE[state]} data-build-migrations={state}>
              {state}
            </Badge>
          </dd>
        </dl>

        <Text size="xs" tone="secondary">
          {t('studio.env.buildNote')}
        </Text>
      </Stack>
    </Surface>
  )
}
