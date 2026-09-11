export interface ComputedBuildInfo {
  readonly sha: string
  readonly branch: string
  readonly builtAt: string
  readonly environment: string
  readonly migrationsOnDisk: number
  readonly latestMigrationFile: string | null
}
export declare function computeBuildInfo(cwd?: string): ComputedBuildInfo
