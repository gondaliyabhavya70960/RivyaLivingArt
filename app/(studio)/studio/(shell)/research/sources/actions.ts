'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { StudioFormState } from '@/components/studio/form-state'
import { requirePermission } from '@/lib/auth/require'
import { roleHasPermission } from '@/lib/auth/permissions'
import { writeAudit } from '@/lib/auth/audit'
import { isEnabled } from '@/lib/flags'
import { getAdapterDescriptor } from '@/lib/scraper/adapters/registry'
import { hostMatchesBase } from '@/lib/scraper/core/url-patterns'
import {
  categoryMappingInputSchema,
  policyDecisionSchema,
  scheduleInputSchema,
  sourceInputSchema,
  urlPatternInputSchema,
} from '@/lib/scraper/core/source-schema'
import { createAdminClient } from '@/lib/supabase/admin'
import { PermissionError, ValidationError } from '@/lib/supabase/errors'
import {
  deleteCategoryMapping,
  deleteSourceSchedule,
  deleteUrlPattern,
  upsertCategoryMapping,
  upsertSourceSchedule,
  upsertUrlPattern,
} from '@/lib/supabase/repositories/research/source-config'
import {
  createResearchSource,
  getResearchSource,
  setPolicyReview,
  setSourceEnabled,
  setSourceReadiness,
  updateResearchSource,
} from '@/lib/supabase/repositories/research/sources'
import { createClient } from '@/lib/supabase/server'
import { probeOneUrl } from '@/lib/scraper/workflows/probe'

/**
 * Configuring a source, and the two acts on this page that are not configuration.
 *
 * `'use server'` PUBLISHES EVERY EXPORT AS AN HTTP ENDPOINT, so `requirePermission` is the first
 * statement of each one. Most of this file is `research.write` — owner, admin, researcher — because
 * FEAT §26's twenty-three fields are configuration, and configuration is what a researcher operates.
 *
 * TWO ACTIONS ARE DIFFERENT AND BOTH ARE DELIBERATE.
 *
 *   `recordPolicyReviewAction` and `setSourceEnabledAction` require `research.write` AND
 *   `system.settings.write` — owner and admin. RLS gates a ROW, not a COLUMN, so as far as
 *   PostgreSQL is concerned a researcher who may edit a source's delay may also write its
 *   `policy_status`. This pair of checks is what actually draws that line, and the row-level
 *   `research_sources_approval_is_attributed` is the net underneath: an approval naming nobody is
 *   unstorable whatever the session.
 *
 *   `probeUrlAction` makes A REAL REQUEST TO SOMEBODY ELSE'S SERVER. It is the only thing on this
 *   page that does. It therefore checks the kill switch, refuses an unapproved source, refuses an
 *   off-host URL, goes through the same fetcher every scheduled run uses — so robots.txt, the
 *   delay and the circuit breaker all apply — and writes an audit row naming the person who asked.
 *   The PATTERN TESTER beside it makes no request at all and needs none of that; it is a GET on the
 *   page itself, which is why there is no `testPatternsAction` here.
 *
 * NOTHING IN THIS FILE WRITES TO A PUBLIC TABLE. The one column that points at one —
 * `research_source_category_map.category_id` — is written FROM a form a person filled in, never
 * from anything a page said (isolation invariant I4).
 */

const SOURCES_PATH = '/studio/research/sources'

function issue(message: string, code: string, field = '_form'): StudioFormState {
  return { status: 'error', issues: [{ field, code, message }] }
}

function refusal(error: unknown): StudioFormState {
  if (error instanceof ValidationError) {
    return {
      status: 'error',
      issues: error.issues.map((i) => ({ field: i.path, code: 'invalid', message: i.message })),
    }
  }
  if (error instanceof PermissionError) return issue('You cannot do that.', 'forbidden')
  return issue('That was refused. Nothing was changed.', 'refused')
}

/** A Zod failure, translated into the shape a Studio form renders. */
function fromZod(error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] }) {
  return {
    status: 'error' as const,
    issues: error.issues.map((i) => ({
      field: i.path.length === 0 ? '_form' : String(i.path[0]),
      code: 'invalid',
      message: i.message,
    })),
  }
}

/** Every FEAT §26 source field, read off the form in one place so create and edit cannot diverge. */
function readSourceForm(form: FormData) {
  const text = (key: string): string => String(form.get(key) ?? '').trim()
  const optional = (key: string): string | null => (text(key) === '' ? null : text(key))
  const json = (key: string, fallback: unknown): unknown => {
    const raw = text(key)
    if (raw === '') return fallback
    try {
      return JSON.parse(raw)
    } catch {
      // A malformed blob reaches the schema as a string and fails there, with the field named —
      // which is a better error than "Unexpected token }" from this function.
      return raw
    }
  }

  return {
    slug: text('slug'),
    name: text('name'),
    baseUrl: text('base_url'),
    /*
     * FOUR FIELDS PASSED AS RAW STRINGS, INCLUDING THE EMPTY ONE, AND THAT IS THE POINT. The
     * columns are nullable and the schema is not: `0240` refuses to default an analytics league
     * because a league is a judgement nobody has made for a row that never went through this form,
     * while a row that DID go through it went through a person, and that person is asked. Mapping
     * an unchosen select to `null` here would turn "you have not answered" into "the answer is
     * nothing", and Zod would accept it. Sent as `''`, it fails on the field, with the control
     * named.
     */
    region: text('region'),
    currency: text('currency'),
    sourceType: text('source_type'),
    analyticsLeague: text('analytics_league'),
    collectionMode: text('collection_mode') || 'SEED_URLS',
    adapterKey: text('adapter_key') || 'generic',
    imageExtractionMode: text('image_extraction_mode') || 'NONE',
    priceExtraction: json('price_extraction', { strategy: 'NONE' }),
    skuExtraction: json('sku_extraction', { strategy: 'NONE' }),
    attributeExtraction: json('attribute_extraction', []),
    rateLimitRpm: Number(text('rate_limit_rpm') || '20'),
    requestDelayMs: Number(text('request_delay_ms') || '3000'),
    concurrency: Number(text('concurrency') || '1'),
    notes: optional('notes'),
    readiness: text('readiness') || 'DRAFT',
  }
}

export async function createSourceAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  let created: string | null = null
  try {
    const session = await requirePermission('research.write')
    const parsed = sourceInputSchema.safeParse(readSourceForm(form))
    if (!parsed.success) return fromZod(parsed.error)

    const client = await createClient()
    created = await createResearchSource(client, {
      slug: parsed.data.slug,
      name: parsed.data.name,
      baseUrl: parsed.data.baseUrl,
      region: parsed.data.region,
      currency: parsed.data.currency,
      sourceType: parsed.data.sourceType,
      actorId: session.userId,
    })
    // THE REST OF THE FIELDS ARE WRITTEN BY THE UPDATE, not by a widened insert. `createResearchSource`
    // exists to guarantee one thing — a new source is UNREVIEWED and disabled — and widening it to
    // take twenty-three arguments would put that guarantee in a function with twenty-three reasons
    // to be edited.
    await updateResearchSource(client, created, { ...parsed.data, actorId: session.userId })

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.source.create',
      result: 'SUCCESS',
      entityType: 'research_source',
      entityId: created,
      summary: `created source "${parsed.data.slug}"`,
      after: { slug: parsed.data.slug, baseUrl: parsed.data.baseUrl },
    })

    revalidatePath(SOURCES_PATH)
  } catch (error) {
    return refusal(error)
  }
  // OUTSIDE THE try, because `redirect` works by throwing and a catch that swallowed it would
  // turn a successful save into "That was refused. Nothing was changed."
  redirect(`${SOURCES_PATH}/${created}`)
}

export async function saveSourceAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')
    const id = String(form.get('id') ?? '')
    if (id === '') return issue('That source could not be identified.', 'required')

    const parsed = sourceInputSchema.safeParse(readSourceForm(form))
    if (!parsed.success) return fromZod(parsed.error)

    /*
     * THE ADAPTER OVERRIDE IS RECORDED, NOT PREVENTED. `supports()` is an adapter's own claim about
     * what it can read, and it is a claim rather than a fact — a site the generic adapter refuses
     * may still be readable, and the person configuring it may know that. What must not happen is
     * the choice being made silently, so an unsupported adapter needs the tick and the tick lands
     * in the audit row.
     */
    const descriptor = getAdapterDescriptor(parsed.data.adapterKey)
    if (descriptor === null) {
      return issue('That adapter does not exist.', 'unknown_adapter', 'adapter_key')
    }
    const supported = descriptor.supports({ baseUrl: parsed.data.baseUrl })
    const overridden = form.get('adapter_override') === 'on'
    if (!supported && !overridden) {
      return issue(
        `The ${descriptor.key} adapter does not claim to support that website. Tick the override if you have checked it yourself.`,
        'unsupported_adapter',
        'adapter_key',
      )
    }

    const client = await createClient()
    const before = await getResearchSource(client, id)
    if (before === null) return issue('That source could not be found.', 'not_found')

    await updateResearchSource(client, id, { ...parsed.data, actorId: session.userId })

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.source.update',
      result: 'SUCCESS',
      entityType: 'research_source',
      entityId: id,
      summary: overridden
        ? `updated source "${before.slug}" with an unsupported adapter override`
        : `updated source "${before.slug}"`,
      before: { adapterKey: before.adapter_key, rateLimitRpm: before.rate_limit_rpm },
      after: {
        adapterKey: parsed.data.adapterKey,
        rateLimitRpm: parsed.data.rateLimitRpm,
        adapterOverride: overridden,
      },
    })

    revalidatePath(`${SOURCES_PATH}/${id}`)
    revalidatePath(SOURCES_PATH)
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

export async function setReadinessAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')
    const id = String(form.get('id') ?? '')
    const readiness = String(form.get('readiness') ?? '')
    if (id === '') return issue('That source could not be identified.', 'required')
    if (readiness !== 'DRAFT' && readiness !== 'READY_FOR_REVIEW') {
      // REVIEWED IS NOT SETTABLE HERE, and that is the whole point of the column. It is written by
      // the policy decision, which is an owner's act; a researcher marking their own source
      // REVIEWED would be answering the question they asked.
      return issue('A source is marked ready for review, or returned to draft.', 'invalid')
    }

    const client = await createClient()
    await setSourceReadiness(client, id, readiness, session.userId)

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.source.readiness',
      result: 'SUCCESS',
      entityType: 'research_source',
      entityId: id,
      summary: `readiness set to ${readiness}`,
      after: { readiness },
    })

    revalidatePath(`${SOURCES_PATH}/${id}`)
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

/**
 * Record the policy review.
 *
 * OWNER AND ADMIN ONLY, CHECKED AS A PAIR. `requirePermission` takes one permission, so the second
 * is checked explicitly against the session's role and the DENIED row is written here — the same
 * shape `requirePermission` writes, because a refusal that is not in the audit log is a refusal
 * nobody can review.
 */
export async function recordPolicyReviewAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')
    if (!roleHasPermission(session.role, 'system.settings.write')) {
      await writeAudit({
        actorUserId: session.userId,
        actorRole: session.role,
        action: 'research.source.policy_review',
        result: 'DENIED',
        entityType: 'research_source',
        entityId: String(form.get('id') ?? ''),
        summary: `role "${session.role}" attempted to record a policy review`,
      })
      return issue(
        'Recording a policy review is the owner’s decision. It needs system settings permission as well as research.',
        'forbidden',
      )
    }

    const id = String(form.get('id') ?? '')
    if (id === '') return issue('That source could not be identified.', 'required')

    const parsed = policyDecisionSchema.safeParse({
      status: String(form.get('status') ?? ''),
      notes: String(form.get('notes') ?? ''),
    })
    if (!parsed.success) return fromZod(parsed.error)

    const client = await createClient()
    const before = await getResearchSource(client, id)
    if (before === null) return issue('That source could not be found.', 'not_found')

    await setPolicyReview(client, id, {
      status: parsed.data.status,
      notes: parsed.data.notes,
      actorId: session.userId,
    })
    await setSourceReadiness(client, id, 'REVIEWED', session.userId)

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.source.policy_review',
      result: 'SUCCESS',
      entityType: 'research_source',
      entityId: id,
      summary: `policy review recorded as ${parsed.data.status}`,
      before: { policyStatus: before.policy_status },
      after: { policyStatus: parsed.data.status, notes: parsed.data.notes },
    })

    revalidatePath(`${SOURCES_PATH}/${id}`)
    revalidatePath(SOURCES_PATH)
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

export async function setSourceEnabledAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')
    const id = String(form.get('id') ?? '')
    const enable = form.get('enable') === 'on'

    if (!roleHasPermission(session.role, 'system.settings.write')) {
      await writeAudit({
        actorUserId: session.userId,
        actorRole: session.role,
        action: 'research.source.enable',
        result: 'DENIED',
        entityType: 'research_source',
        entityId: id,
        summary: `role "${session.role}" attempted to ${enable ? 'enable' : 'disable'} a source`,
      })
      return issue('Switching a source on or off is an owner or admin decision.', 'forbidden')
    }
    if (id === '') return issue('That source could not be identified.', 'required')

    const client = await createClient()
    /*
     * NO PRE-CHECK OF `policy_status` HERE, DELIBERATELY. `research_sources_enabled_requires_approval`
     * refuses an enabled-but-unapproved source at the row, and letting the constraint speak means
     * the rule has exactly one enforcement point rather than two that can disagree. The typed
     * ValidationError names the constraint, which is what the copy below turns into a sentence.
     */
    try {
      await setSourceEnabled(client, id, enable, session.userId)
    } catch (error) {
      await writeAudit({
        actorUserId: session.userId,
        actorRole: session.role,
        action: 'research.source.enable',
        result: 'DENIED',
        entityType: 'research_source',
        entityId: id,
        summary: 'the row refused an enabled source with no recorded approval',
      })
      if (String(error).includes('enabled_requires_approval')) {
        return issue(
          'A source cannot be switched on until its policy review is recorded as approved.',
          'unapproved',
        )
      }
      throw error
    }

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.source.enable',
      result: 'SUCCESS',
      entityType: 'research_source',
      entityId: id,
      summary: enable ? 'source switched on' : 'source switched off',
      after: { isEnabled: enable },
    })

    revalidatePath(`${SOURCES_PATH}/${id}`)
    revalidatePath(SOURCES_PATH)
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

// --- the three child collections ---------------------------------------------------------------

export async function saveUrlPatternAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')
    const sourceId = String(form.get('source_id') ?? '')
    if (sourceId === '') return issue('That source could not be identified.', 'required')

    const parsed = urlPatternInputSchema.safeParse({
      kind: String(form.get('kind') ?? ''),
      pattern: String(form.get('pattern') ?? '').trim(),
      isRegex: form.get('is_regex') === 'on',
      priority: Number(String(form.get('priority') ?? '0')),
      notes: String(form.get('notes') ?? '').trim() || null,
    })
    if (!parsed.success) return fromZod(parsed.error)

    const client = await createClient()
    const source = await getResearchSource(client, sourceId)
    if (source === null) return issue('That source could not be found.', 'not_found')

    // FEAT §26 FIELD 2: EVERY PATTERN'S HOST MUST BE THE SOURCE'S. A pattern pointing at another
    // host is how a run walks off the website somebody approved, and it is a relationship between
    // two tables that no CHECK can express.
    if (!hostMatchesBase(parsed.data.pattern, source.base_url)) {
      return issue(
        `That pattern names a different website. A source is approved for one host.`,
        'off_host',
        'pattern',
      )
    }

    await upsertUrlPattern(client, {
      id: String(form.get('id') ?? '') || null,
      sourceId,
      ...parsed.data,
      actorId: session.userId,
    })

    revalidatePath(`${SOURCES_PATH}/${sourceId}`)
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

export async function deleteUrlPatternAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    // DELETING A PATTERN IS `destructive.execute`, and the reason is counter-intuitive enough to
    // state at the call site: removing an EXCLUDE row does not remove information, it WIDENS what
    // Rivya will fetch. The RLS policy says the same thing at the table.
    const session = await requirePermission('destructive.execute')
    const id = String(form.get('id') ?? '')
    const sourceId = String(form.get('source_id') ?? '')
    if (id === '') return issue('That pattern could not be identified.', 'required')

    const client = await createClient()
    await deleteUrlPattern(client, id)

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.source.pattern.delete',
      result: 'SUCCESS',
      entityType: 'research_source_url_pattern',
      entityId: id,
      summary: 'URL pattern removed',
    })

    revalidatePath(`${SOURCES_PATH}/${sourceId}`)
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

export async function saveCategoryMappingAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')
    const sourceId = String(form.get('source_id') ?? '')
    if (sourceId === '') return issue('That source could not be identified.', 'required')

    const isIgnored = form.get('is_ignored') === 'on'
    const parsed = categoryMappingInputSchema.safeParse({
      sourceLabel: String(form.get('source_label') ?? '').trim(),
      sourcePath: String(form.get('source_path') ?? '').trim() || null,
      categoryId: isIgnored ? null : String(form.get('category_id') ?? '') || null,
      isIgnored,
    })
    if (!parsed.success) return fromZod(parsed.error)

    const client = await createClient()
    await upsertCategoryMapping(client, {
      id: String(form.get('id') ?? '') || null,
      sourceId,
      ...parsed.data,
      actorId: session.userId,
    })

    revalidatePath(`${SOURCES_PATH}/${sourceId}`)
    revalidatePath('/studio/research/dashboard')
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

export async function deleteCategoryMappingAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    await requirePermission('destructive.execute')
    const id = String(form.get('id') ?? '')
    const sourceId = String(form.get('source_id') ?? '')
    if (id === '') return issue('That mapping could not be identified.', 'required')

    const client = await createClient()
    await deleteCategoryMapping(client, id)

    revalidatePath(`${SOURCES_PATH}/${sourceId}`)
    revalidatePath('/studio/research/dashboard')
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

export async function saveScheduleAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')
    const sourceId = String(form.get('source_id') ?? '')
    if (sourceId === '') return issue('That source could not be identified.', 'required')

    const parsed = scheduleInputSchema.safeParse({
      jobType: String(form.get('job_type') ?? ''),
      cronExpression: String(form.get('cron_expression') ?? '').trim(),
      timezone: 'UTC',
      isEnabled: form.get('is_enabled') === 'on',
    })
    if (!parsed.success) return fromZod(parsed.error)

    const client = await createClient()
    await upsertSourceSchedule(client, {
      id: String(form.get('id') ?? '') || null,
      sourceId,
      ...parsed.data,
      actorId: session.userId,
    })

    revalidatePath(`${SOURCES_PATH}/${sourceId}`)
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

export async function deleteScheduleAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    await requirePermission('destructive.execute')
    const id = String(form.get('id') ?? '')
    const sourceId = String(form.get('source_id') ?? '')
    if (id === '') return issue('That schedule could not be identified.', 'required')

    const client = await createClient()
    await deleteSourceSchedule(client, id)

    revalidatePath(`${SOURCES_PATH}/${sourceId}`)
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

/**
 * Fetch exactly one page, on purpose, with somebody's name against it.
 *
 * THE ONLY ACTION ON THIS SURFACE THAT TOUCHES THE NETWORK. Everything it checks is checked because
 * a probe is a real request to a third party: the kill switch, so an owner who has switched
 * research off is not overridden by a form; the policy review, because approval is what makes
 * reading the site permissible at all; the host, because approval is per website; and robots.txt
 * plus the source's delay, because those are honoured by every other request Rivya makes and a
 * "just checking" request is not an exception.
 *
 * IT GOES THROUGH THE SAME FETCHER THE DRAIN LOOP USES rather than calling `fetch` here. A second
 * path to the network is a second place for the politeness rules to be missing.
 */
export async function probeUrlAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')
    const sourceId = String(form.get('source_id') ?? '')
    const url = String(form.get('url') ?? '').trim()
    if (sourceId === '' || url === '') return issue('Give a source and one URL.', 'required')

    if (!(await isEnabled('research_enabled'))) {
      return issue(
        'Research is switched off, so nothing may be fetched. Turn it on under System › Feature flags first.',
        'disabled',
      )
    }

    const client = await createClient()
    const source = await getResearchSource(client, sourceId)
    if (source === null) return issue('That source could not be found.', 'not_found')
    if (source.policy_status !== 'APPROVED') {
      return issue(
        'That source has not been approved for reading. An owner or admin records the policy review first.',
        'unapproved',
      )
    }

    let host: string
    try {
      host = new URL(url).host.toLowerCase()
    } catch {
      return issue('That is not a URL.', 'invalid', 'url')
    }
    if (host !== new URL(source.base_url).host.toLowerCase()) {
      return issue(`That URL is not on ${new URL(source.base_url).host}.`, 'off_host', 'url')
    }

    const admin = createAdminClient()
    const outcome = await probeOneUrl(admin, { sourceId, url })

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.source.probe',
      result: outcome.robotsDecision === 'DISALLOWED' ? 'DENIED' : 'SUCCESS',
      entityType: 'research_source',
      entityId: sourceId,
      summary: `probed one URL: ${outcome.robotsDecision}${outcome.httpStatus === null ? '' : ` ${outcome.httpStatus}`}`,
      after: { url, robotsDecision: outcome.robotsDecision, httpStatus: outcome.httpStatus },
    })

    revalidatePath(`${SOURCES_PATH}/${sourceId}`)

    if (outcome.robotsDecision === 'DISALLOWED') {
      return issue(
        'robots.txt disallows that path, so no request was made. The refusal is recorded.',
        'disallowed',
        'url',
      )
    }
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}
