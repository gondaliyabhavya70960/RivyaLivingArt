#!/usr/bin/env node
/**
 * db:types — generate lib/supabase/database.types.ts by introspecting a live database.
 *
 * WHY THIS EXISTS INSTEAD OF `supabase gen types`
 * -----------------------------------------------
 * The Supabase CLI's generator shells out to a Docker image even when handed --db-url, so it
 * cannot run where Docker is unavailable — which includes this project's development sandbox, and
 * which would also make the CI drift check depend on pulling a container image on every run. This
 * generator reads the catalog over an ordinary PostgreSQL connection instead: no Docker, no image
 * pull, and it runs anywhere psql can connect.
 *
 * It emits the same shape the Supabase client expects (Database.public.{Tables,Views,Functions,
 * Enums,CompositeTypes} plus the Tables/TablesInsert/TablesUpdate/Enums helpers), because
 * @supabase/supabase-js is typed against that shape and the repositories depend on it.
 *
 * DETERMINISM IS THE WHOLE POINT. The output is the input to `git diff --exit-code`, so identical
 * schemas must produce byte-identical files. Every query is explicitly ORDER BY'd — catalog scans
 * have no inherent order — and the result is run through Prettier so formatting can never be the
 * thing that differs.
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const OUT = 'lib/supabase/database.types.ts'
const SCHEMA = 'public'

/**
 * Tables that exist in `public` but are not part of the application schema.
 *
 * `schema_migrations` is `db:migrate`'s own bookkeeping — version and checksum per applied file.
 * It is created by the migration runner rather than by a migration, so whether it exists at
 * generation time depends on whether anyone has run `db:migrate` against that database yet. That
 * makes it a source of PHANTOM DRIFT: the same schema generates two different files depending on
 * how it was built, and the CI drift check fails on a difference nobody made. No repository reads
 * it and PostgREST never exposes it, so excluding it costs nothing and removes the ambiguity.
 */
const NON_APPLICATION_TABLES = ["'schema_migrations'"].join(', ')

// Record and field separators. Chosen because neither can appear in a PostgreSQL identifier, an
// enum label, or any expression this script reads back.
const FS = '\x1f'
const RS = '\x1e'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. See docs/ops/ENVIRONMENT.md.')
  process.exit(1)
}

/** Run a query and return its rows as arrays of field strings. */
function query(sql) {
  const out = execFileSync(
    'psql',
    [
      url,
      '--no-psqlrc',
      '--quiet',
      '--tuples-only',
      '--no-align',
      '--field-separator',
      FS,
      '--record-separator',
      RS,
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      sql,
    ],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  )
  return out
    .split(RS)
    .map((line) => line.replace(/\n/g, ''))
    .filter((line) => line.length > 0)
    .map((line) => line.split(FS))
}

// --- catalog reads -----------------------------------------------------------------------------

const enums = query(`
  select t.typname, e.enumlabel
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = '${SCHEMA}'
  order by t.typname, e.enumsortorder;
`)

/**
 * The `public` functions PostgREST publishes as RPC endpoints.
 *
 * WITHOUT THIS, `Functions` WAS `{ [_ in never]: never }` AND NO RPC NAME TYPECHECKED AT ALL —
 * `client.rpc(name)` takes `name: keyof Schema['Functions']`, which is `never`, so every call was
 * a type error and the only way to write one was a cast. Casting past the type system for
 * `cms_publish_section` — SECURITY DEFINER, promotes media, takes the actor as a parameter — is
 * the wrong place to start making exceptions.
 *
 * Trigger functions are excluded: they return `trigger`, are never callable over PostgREST, and
 * listing them would invite somebody to try. Ordered by name so two runs agree byte for byte.
 */
const functions = query(`
  select p.proname,
         pg_get_function_arguments(p.oid),
         t.typname,
         t.typtype
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_type t on t.oid = p.prorettype
  where n.nspname = '${SCHEMA}'
    and t.typname <> 'trigger'
    and p.prokind = 'f'
  order by p.proname;
`)

const columns = query(`
  select c.table_name,
         c.column_name,
         c.is_nullable,
         case when c.column_default is null then 'f' else 't' end as has_default,
         c.data_type,
         coalesce(c.udt_name, ''),
         coalesce(e.data_type, ''),
         coalesce(e.udt_name, '')
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema
   and t.table_name = c.table_name
   and t.table_type = 'BASE TABLE'
  left join information_schema.element_types e
    on  e.object_catalog = c.table_catalog
    and e.object_schema  = c.table_schema
    and e.object_name    = c.table_name
    and e.object_type    = 'TABLE'
    and e.collection_type_identifier = c.dtd_identifier
  where c.table_schema = '${SCHEMA}'
    and c.table_name not in (${NON_APPLICATION_TABLES})
  order by c.table_name, c.ordinal_position;
`)

// Foreign keys, for the Relationships block the Supabase client uses to type joined selects.
const foreignKeys = query(`
  select con.conname,
         src.relname,
         (select string_agg(a.attname, ',' order by k.ord)
            from unnest(con.conkey) with ordinality k(attnum, ord)
            join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum),
         tgt.relname,
         (select string_agg(a.attname, ',' order by k.ord)
            from unnest(con.confkey) with ordinality k(attnum, ord)
            join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum),
         case when exists (
           select 1 from pg_constraint u
           where u.conrelid = con.conrelid and u.contype in ('p','u')
             and u.conkey @> con.conkey and con.conkey @> u.conkey
         ) then 't' else 'f' end
  from pg_constraint con
  join pg_class src on src.oid = con.conrelid
  join pg_class tgt on tgt.oid = con.confrelid
  join pg_namespace n on n.oid = src.relnamespace
  where con.contype = 'f' and n.nspname = '${SCHEMA}'
  order by src.relname, con.conname;
`)

// --- type mapping ------------------------------------------------------------------------------

/**
 * PostgreSQL type -> TypeScript type.
 *
 * bigint and numeric map to `number`, matching what supabase-js actually receives: PostgREST
 * serialises them as JSON numbers. That is lossy above 2^53 — money is stored in minor units so a
 * realistic amount stays far below it, and the alternative (string) would misrepresent what the
 * client is handed.
 *
 * citext arrives from information_schema as data_type 'USER-DEFINED' with udt_name 'citext'. It is
 * a string, not an enum, so it is matched on udt_name BEFORE the USER-DEFINED branch — otherwise
 * every slug in the schema would be typed as a non-existent enum.
 */
function scalar(dataType, udtName) {
  if (udtName === 'citext') return 'string'
  if (dataType === 'USER-DEFINED') return `Database["${SCHEMA}"]["Enums"]["${udtName}"]`
  switch (dataType) {
    case 'uuid':
    case 'text':
    case 'character varying':
    case 'character':
    case 'name':
    case 'timestamp with time zone':
    case 'timestamp without time zone':
    case 'date':
    case 'time with time zone':
    case 'time without time zone':
    case 'interval':
      return 'string'
    case 'smallint':
    case 'integer':
    case 'bigint':
    case 'numeric':
    case 'real':
    case 'double precision':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'json':
    case 'jsonb':
      return 'Json'
    default:
      return 'unknown'
  }
}

function mapColumn(dataType, udtName, elementDataType, elementUdtName) {
  if (dataType === 'ARRAY') return `${scalar(elementDataType, elementUdtName)}[]`
  return scalar(dataType, udtName)
}

// --- assemble ----------------------------------------------------------------------------------

const enumsByName = new Map()
for (const [name, label] of enums) {
  if (!enumsByName.has(name)) enumsByName.set(name, [])
  enumsByName.get(name).push(label)
}

const tables = new Map()
for (const [
  table,
  column,
  isNullable,
  hasDefault,
  dataType,
  udtName,
  elementDataType,
  elementUdtName,
] of columns) {
  if (!tables.has(table)) tables.set(table, [])
  tables.get(table).push({
    column,
    nullable: isNullable === 'YES',
    hasDefault: hasDefault === 't',
    ts: mapColumn(dataType, udtName, elementDataType, elementUdtName),
  })
}

const fksByTable = new Map()
for (const [
  name,
  sourceTable,
  sourceColumns,
  targetTable,
  targetColumns,
  oneToOne,
] of foreignKeys) {
  if (!fksByTable.has(sourceTable)) fksByTable.set(sourceTable, [])
  fksByTable.get(sourceTable).push({ name, sourceColumns, targetTable, targetColumns, oneToOne })
}

const q = (s) => JSON.stringify(s)

let body = ''
for (const table of [...tables.keys()].sort()) {
  const cols = tables.get(table)
  const row = cols
    .map((c) => `          ${c.column}: ${c.ts}${c.nullable ? ' | null' : ''}`)
    .join('\n')
  // Optional on insert when the database can supply a value: it has a default, or it accepts null.
  const insert = cols
    .map((c) => {
      const optional = c.hasDefault || c.nullable
      return `          ${c.column}${optional ? '?' : ''}: ${c.ts}${c.nullable ? ' | null' : ''}`
    })
    .join('\n')
  const update = cols
    .map((c) => `          ${c.column}?: ${c.ts}${c.nullable ? ' | null' : ''}`)
    .join('\n')

  const fks = (fksByTable.get(table) ?? [])
    .map(
      (f) =>
        `          {\n` +
        `            foreignKeyName: ${q(f.name)}\n` +
        `            columns: [${f.sourceColumns.split(',').map(q).join(', ')}]\n` +
        `            isOneToOne: ${f.oneToOne === 't'}\n` +
        `            referencedRelation: ${q(f.targetTable)}\n` +
        `            referencedColumns: [${f.targetColumns.split(',').map(q).join(', ')}]\n` +
        `          }`,
    )
    .join(',\n')

  body +=
    `      ${table}: {\n` +
    `        Row: {\n${row}\n        }\n` +
    `        Insert: {\n${insert}\n        }\n` +
    `        Update: {\n${update}\n        }\n` +
    `        Relationships: [${fks ? `\n${fks}\n        ` : ''}]\n` +
    `      }\n`
}

let enumBody = ''
for (const name of [...enumsByName.keys()].sort()) {
  enumBody += `      ${name}: ${enumsByName.get(name).map(q).join(' | ')}\n`
}

/**
 * `Args` is deliberately `Record<string, unknown>` rather than a per-parameter shape.
 *
 * Rendering the real argument types would be a lie with a type on it: the repository layer builds
 * these objects, and a name/type pair here would be checked against what the CALLER wrote, not
 * against what the function accepts — PostgREST matches arguments by NAME at runtime, and a
 * misspelled key is a 404 from the server, not a compile error. What this map genuinely buys is
 * that the function NAME is checked, which is what `rpc()` needs and what was missing entirely.
 * The arguments stay Zod's job, at the repository boundary where every other input is validated.
 */
let functionBody = ''
{
  const seen = new Set()
  for (const [name] of functions) {
    // Overloads collapse to one entry: `rpc()` cares about the name, and TypeScript cannot express
    // two members with one key anyway.
    if (seen.has(name)) continue
    seen.add(name)
    functionBody +=
      `      ${name}: {\n` +
      `        Args: Record<string, unknown>\n` +
      `        Returns: Json\n` +
      `      }\n`
  }
  if (functionBody === '') functionBody = '      [_ in never]: never\n'
}

const file = `// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced by \`npm run db:types\`, which introspects a live database. Every hand edit is reverted
// by the next run, and CI fails the build on any difference between this file and a fresh
// generation (\`npm run db:check-types\`). If a type here is wrong, the migration is wrong.
//
// Source of truth: supabase/migrations/**.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  ${SCHEMA}: {
    Tables: {
${body}    }
    Views: {
      [_ in never]: never
    }
    Functions: {
${functionBody}    }
    Enums: {
${enumBody}    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[${q(SCHEMA)}]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
export type TableName = keyof PublicSchema["Tables"]
`

writeFileSync(OUT, file)

// Prettier last, so formatting can never be what makes the drift check fail.
execFileSync('npx', ['prettier', '--write', OUT], { stdio: 'ignore' })

console.log(
  `✓ ${OUT} — ${tables.size} tables, ${enumsByName.size} enums, ` +
    `${new Set(functions.map(([n]) => n)).size} callable functions`,
)
