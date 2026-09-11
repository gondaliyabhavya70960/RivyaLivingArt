import { build } from './build'
import { cloudinary } from './cloudinary'
import { googleSheets } from './google-sheets'
import { higgsfield } from './higgsfield'
import { migrations } from './migrations'
import { supabaseAuth } from './supabase-auth'
import { supabaseDb } from './supabase-db'
import type { EnvCheck } from './types'
import { vercel } from './vercel'

/** The eight checks, in the order the page renders them (ENVIRONMENT §7.2). */
export const ENV_CHECKS: readonly EnvCheck[] = [
  supabaseDb,
  supabaseAuth,
  cloudinary,
  googleSheets,
  vercel,
  higgsfield,
  migrations,
  build,
]

export * from './types'
