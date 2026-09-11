#!/usr/bin/env node
/**
 * Build information — Phase 38.
 *
 * COMPUTED ONCE, AT BUILD TIME, AND CARRIED AS A STRING. `next.config.ts` calls `computeBuildInfo()`
 * and inlines the JSON into `process.env.RIVYA_BUILD_INFO`, which is how `lib/ops/build-info.ts`
 * reads it at request time without a generated module the type-checker would have to find before
 * the build ran, and without running git on a request. Nothing here is a secret: a commit SHA, a
 * branch, a timestamp, an environment name, and the count and newest name of the migration files
 * on disk — the `migrations` check compares those with what the database has applied.
 *
 * `git rev-parse` first, Vercel's own variables second (the Vercel build container has no .git),
 * `unknown` last. Never throws: a build that cannot describe itself is still a build.
 */
import { execSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

function git(args, cwd) {
  try {
    return execSync(`git ${args}`, {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim()
  } catch {
    return null
  }
}

function migrationsOnDisk(cwd) {
  try {
    const files = readdirSync(join(cwd, 'supabase', 'migrations'))
      .filter((name) => /^\d{4}_.*\.sql$/u.test(name))
      .sort()
    return { count: files.length, latest: files.at(-1)?.replace(/\.sql$/u, '') ?? null }
  } catch {
    return { count: 0, latest: null }
  }
}

/**
 * @param {string} [cwd]
 * @returns {{ sha: string, branch: string, builtAt: string, environment: string, migrationsOnDisk: number, latestMigrationFile: string | null }}
 */
export function computeBuildInfo(cwd = process.cwd()) {
  const env = process.env
  const sha = env.VERCEL_GIT_COMMIT_SHA || git('rev-parse HEAD', cwd) || 'unknown'
  const branch = env.VERCEL_GIT_COMMIT_REF || git('rev-parse --abbrev-ref HEAD', cwd) || 'unknown'
  const environment = env.VERCEL_ENV || (env.CI === 'true' ? 'ci' : 'local')
  const migrations = migrationsOnDisk(cwd)
  return {
    sha,
    branch,
    builtAt: new Date().toISOString(),
    environment,
    migrationsOnDisk: migrations.count,
    latestMigrationFile: migrations.latest,
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  console.log(JSON.stringify(computeBuildInfo(), null, 2))
}
