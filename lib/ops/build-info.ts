import { z } from 'zod'

/**
 * What was deployed — Phase 38. Read from the string `next.config.ts` inlined at build time
 * (`scripts/build/build-info.mjs`), with Vercel's own variables as the fallback for a runtime that
 * somehow lacks it. Identifiers only: a SHA, a branch, a time, an environment name, the migration
 * files the build saw. No variable value travels here.
 */

export const buildInfoSchema = z.object({
  sha: z.string().min(1),
  branch: z.string().min(1),
  builtAt: z.string().min(1),
  environment: z.string().min(1),
  migrationsOnDisk: z.number().int().nonnegative(),
  latestMigrationFile: z.string().nullable(),
})
export type BuildInfo = z.infer<typeof buildInfoSchema>

export const UNKNOWN_BUILD: BuildInfo = {
  sha: 'unknown',
  branch: 'unknown',
  builtAt: 'unknown',
  environment: 'unknown',
  migrationsOnDisk: 0,
  latestMigrationFile: null,
}

export function readBuildInfo(env: NodeJS.ProcessEnv = process.env): BuildInfo {
  const raw = env.RIVYA_BUILD_INFO
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      const parsed = buildInfoSchema.safeParse(JSON.parse(raw))
      if (parsed.success) return parsed.data
    } catch {
      // Fall through to the environment.
    }
  }
  return {
    ...UNKNOWN_BUILD,
    sha: env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
    branch: env.VERCEL_GIT_COMMIT_REF ?? 'unknown',
    environment: env.VERCEL_ENV ?? 'unknown',
  }
}

/** The first twelve characters — enough to find a commit, short enough for a table cell. */
export function shortSha(sha: string): string {
  return sha === 'unknown' ? sha : sha.slice(0, 12)
}
