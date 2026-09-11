import { seedModules } from '../../content/seed/index'
import { contentHash } from './hash'

/**
 * `npx tsx scripts/seed/emit-sql.ts [--only=key1,key2,…] > rows.sql`
 *
 * The seed runner's INSERT path, as SQL text, for `global_content` rows (or one other table via
 * `--table=`).
 *
 * WHY IT EXISTS. `npm run seed:content` needs a `DATABASE_URL`, and there are environments where
 * the hosted database is reachable through the Supabase MCP and nowhere else. Hand-writing rows
 * there would omit `seed_content_hash`, and a row without its hash reads to every later run as
 * owner-edited and is skipped for ever. This emits exactly what the runner would write — the
 * module's declared fields, the same hash over the same fields, the same version stamp — so a row
 * applied this way and a row applied by the runner are indistinguishable afterwards.
 *
 * `global_content` ONLY, and only records with no `refs` and no `media`: those two need ids that
 * exist in the target database, which is the runner's job. A `where not exists` on the
 * seed key keeps a re-run harmless.
 */

const only = process.argv
  .find((arg) => arg.startsWith('--only='))
  ?.slice('--only='.length)
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean)
const wanted = only === undefined ? null : new Set(only)
const version =
  process.argv.find((arg) => arg.startsWith('--version='))?.slice('--version='.length) ?? 'rivya-v1'
/**
 * `--table=` widens the emitter to another seedable table with the same Tier C columns and no
 * unique seed key — Phase 39 added `seo_keyword_themes` (a `where not exists` on the seed key is
 * still the idempotence rule there). Default stays `global_content`.
 */
const table =
  process.argv.find((arg) => arg.startsWith('--table='))?.slice('--table='.length) ??
  'global_content'

function literal(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return `array[${value.map(literal).join(', ')}]::text[]`
  return `'${String(value).replace(/'/g, "''")}'`
}

const statements: string[] = []
for (const seedModule of seedModules) {
  for (const record of seedModule.records) {
    if (record.table !== table) continue
    if (wanted !== null && !wanted.has(record.seedKey)) continue
    if (record.refs !== undefined || record.media !== undefined) {
      throw new Error(`${record.seedKey} references other rows; apply it with the seed runner`)
    }
    const names = Object.keys(record.fields).sort()
    const columns = [
      ...names,
      'seed_key',
      'content_seed_version',
      'seed_content_hash',
      'seed_last_applied_at',
    ]
    const values = [
      ...names.map((name) => literal(record.fields[name])),
      literal(record.seedKey),
      literal(version),
      literal(contentHash(record.fields)),
      'now()',
    ]
    // `seed_key` carries an index but no unique constraint (the unique key is `group_key, key`),
    // so idempotence is a `where not exists` on the seed key rather than an `on conflict`.
    statements.push(
      `insert into ${table} (${columns.map((c) => `"${c}"`).join(', ')})\n  select ${values.join(', ')}\n  where not exists (select 1 from ${table} where seed_key = ${literal(record.seedKey)});`,
    )
    wanted?.delete(record.seedKey)
  }
}
if (wanted !== null && wanted.size > 0) {
  throw new Error(`not seeded by any module: ${[...wanted].join(', ')}`)
}
process.stdout.write(statements.join('\n') + '\n')
process.stderr.write(`${statements.length} statement(s)\n`)
