import { createAdminClient } from '@/lib/supabase/admin'
import { readMigrationLedger } from '@/lib/supabase/repositories/ops'

import { readBuildInfo } from '../build-info'
import { outcomeForError, type EnvCheck } from './types'

/**
 * Applied count and latest version from the ledger, against the files the build saw. Runs,
 * repairs or rolls back nothing.
 */
export const migrations: EnvCheck = {
  id: 'migrations',
  requires: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
  channel: 'SYSTEM',
  async probe({ fetch, env, signal }) {
    const build = readBuildInfo(env)
    try {
      const ledger = await readMigrationLedger(createAdminClient({ fetch }), signal)
      if (ledger === null) return { status: 'UNREACHABLE', code: 'HTTP_ERROR' }
      const detail = {
        applied: ledger.applied,
        on_disk: build.migrationsOnDisk,
        latest_applied: ledger.latest ?? 'none',
        latest_file: build.latestMigrationFile ?? 'none',
      }
      if (build.migrationsOnDisk === 0) return { status: 'UNKNOWN', code: 'UNKNOWN', detail }
      if (ledger.applied < build.migrationsOnDisk)
        return { status: 'DEGRADED', code: 'BEHIND', detail }
      if (ledger.applied > build.migrationsOnDisk)
        return { status: 'DEGRADED', code: 'AHEAD', detail }
      return { status: 'OK', code: 'OK', detail }
    } catch (error) {
      return outcomeForError(error)
    }
  },
}
