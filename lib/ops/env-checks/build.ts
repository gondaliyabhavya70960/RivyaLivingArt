import { readBuildInfo, shortSha } from '../build-info'
import type { EnvCheck } from './types'

/** Commit, branch, build time and environment — identifiers, never a variable value. */
export const build: EnvCheck = {
  id: 'build',
  requires: [],
  channel: 'SYSTEM',
  async probe({ env }) {
    const info = readBuildInfo(env)
    const known = info.sha !== 'unknown'
    return {
      status: known ? 'OK' : 'UNKNOWN',
      code: known ? 'OK' : 'UNKNOWN',
      detail: {
        commit: shortSha(info.sha),
        branch: info.branch,
        built_at: info.builtAt,
        environment: info.environment,
        node: process.version,
      },
    }
  },
}
