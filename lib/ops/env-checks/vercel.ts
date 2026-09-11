import { readBuildInfo, shortSha } from '../build-info'
import type { EnvCheck } from './types'

/** Reads the build-info string, not an API. Requires no Vercel token. */
export const vercel: EnvCheck = {
  id: 'vercel',
  requires: [],
  channel: 'SYSTEM',
  async probe({ env }) {
    const info = readBuildInfo(env)
    const onVercel = typeof env.VERCEL === 'string' && env.VERCEL.length > 0
    return {
      status: onVercel ? 'OK' : 'UNKNOWN',
      code: onVercel ? 'OK' : 'UNKNOWN',
      detail: {
        environment: info.environment,
        region: env.VERCEL_REGION ?? 'n/a',
        commit: shortSha(info.sha),
      },
    }
  },
}
