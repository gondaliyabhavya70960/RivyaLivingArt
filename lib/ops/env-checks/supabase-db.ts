import { createAdminClient } from '@/lib/supabase/admin'
import { pingDatabase } from '@/lib/supabase/repositories/ops'

import { outcomeForError, type EnvCheck } from './types'

/** `select 1` through the server client, timed. Never the connection string, host or key. */
export const supabaseDb: EnvCheck = {
  id: 'supabase_db',
  requires: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
  channel: 'SYSTEM',
  async probe({ fetch, signal }) {
    try {
      const ok = await pingDatabase(createAdminClient({ fetch }), signal)
      return ok ? { status: 'OK', code: 'OK' } : { status: 'UNREACHABLE', code: 'HTTP_ERROR' }
    } catch (error) {
      return outcomeForError(error)
    }
  },
}
