import { outcomeForError, outcomeForHttp, type EnvCheck } from './types'

/** A round-trip against the project's auth health endpoint. Never a key. */
export const supabaseAuth: EnvCheck = {
  id: 'supabase_auth',
  requires: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  channel: 'AUTH',
  async probe({ fetch, env, signal }) {
    const url = env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    try {
      const response = await fetch(`${url.replace(/\/$/u, '')}/auth/v1/health`, {
        headers: { apikey: key },
        signal,
      })
      return outcomeForHttp(response.status)
    } catch (error) {
      return outcomeForError(error)
    }
  },
}
