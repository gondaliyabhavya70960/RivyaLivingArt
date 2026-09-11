import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The nine actions, and the two claims their header makes that are worth proving.
 *
 * CLAIM ONE — THE ORDER. Every action writes the append-only log FIRST, the domain effect second,
 * and the queue's decision stamp LAST. There is no transaction (PostgREST offers no handle), so the
 * order is the design: a crash after the log leaves an audited decision the queue still shows as
 * undecided, which is annoying and safe. The reverse would leave a stage moved with nothing saying
 * who moved it, which is the one outcome an audit trail may not permit.
 *
 * CLAIM TWO — WHICH CLIENT. The action row and the note go through the SESSION client so RLS judges
 * the person a second time; the stage move, the pipeline event and the decision stamp go through
 * the ADMIN one, because those tables have no session write policy at all by design. Getting this
 * backwards is how Phase 28 shipped a merchandiser who could not clear a duplicate, so it is
 * asserted rather than described.
 *
 * MOCKED AT THE REPOSITORY BOUNDARY, which is where the two clients become visible. A test against
 * a real database would prove the writes land and would say nothing about which client made them —
 * and "which client" is the half that was wrong last time.
 */

const recordAction = vi.fn(async () => ({ id: 'action-1', action: 'REVIEW', actor_user_id: 'u1' }))
const markDecided = vi.fn(async () => undefined)
const moveStage = vi.fn(async () => ({ from: 'MATCHED', to: 'SHORTLISTED' }))
const setDisposition = vi.fn(async () => undefined)
const recordEventAtCurrentStage = vi.fn(async () => undefined)
const setDuplicateOf = vi.fn(async () => undefined)
const getResearchProduct = vi.fn(async () => ({ id: 'p1', stage: 'MATCHED' }))
const addNote = vi.fn(async () => ({ id: 'note-1' }))
const assignTag = vi.fn(async () => undefined)
const removeTag = vi.fn(async () => undefined)
const markUndone = vi.fn(async () => undefined)
const supersedeNote = vi.fn(async () => undefined)
const latestStandingAction = vi.fn(async () => null)
const writeAudit = vi.fn(async () => undefined)

/** Every call, in the order it happened, with the client it was given. */
const calls: { readonly name: string; readonly client: string }[] = []

function track<T extends (...args: never[]) => unknown>(name: string, fn: T): T {
  return ((...args: unknown[]) => {
    const first = args[0] as { label?: string } | undefined
    calls.push({ name, client: first?.label ?? 'none' })
    return (fn as unknown as (...inner: unknown[]) => unknown)(...args)
  }) as unknown as T
}

vi.mock('@/lib/supabase/repositories/research/review', () => ({
  recordAction: track('recordAction', recordAction),
  addNote: track('addNote', addNote),
  assignTag: track('assignTag', assignTag),
  removeTag: track('removeTag', removeTag),
  markUndone: track('markUndone', markUndone),
  supersedeNote: track('supersedeNote', supersedeNote),
  latestStandingAction: track('latestStandingAction', latestStandingAction),
}))

vi.mock('@/lib/supabase/repositories/research/changes', () => ({
  markDecided: track('markDecided', markDecided),
  getChange: vi.fn(async () => null),
}))

vi.mock('@/lib/supabase/repositories/research/products', () => ({
  getResearchProduct: track('getResearchProduct', getResearchProduct),
  setDuplicateOf: track('setDuplicateOf', setDuplicateOf),
}))

vi.mock('@/lib/scraper/core/stage', async (importOriginal) => ({
  // Phase 35: the movement table and its reason rule are pure and come from the real module.
  ...(await importOriginal<typeof import('@/lib/scraper/core/stage')>()),
  moveStage: track('moveStage', moveStage),
  setDisposition: track('setDisposition', setDisposition),
  recordEventAtCurrentStage: track('recordEventAtCurrentStage', recordEventAtCurrentStage),
}))

vi.mock('@/lib/auth/audit', () => ({ writeAudit }))

/*
 * PHASE 35: the shortlist entry and the confirmation record, mocked at the same boundary. The
 * entry is opened as the person (session client); the score capture is a read.
 */
const getOpenEntry = vi.fn(async () => null)
const openShortlistEntry = vi.fn(async () => ({ id: 'entry-1' }))
const closeShortlistEntry = vi.fn(async () => true)
const readScoreCapture = vi.fn(async () => ({
  score: null,
  confidence: null,
  modelVersion: null,
  scoredAt: null,
}))
const recordConfirmation = vi.fn(async () => ({ id: 'confirmation-1' }))
const getLiveConfirmation = vi.fn(async () => null)
const archiveConfirmation = vi.fn(async () => true)
const logActivity = vi.fn(async () => undefined)

vi.mock('@/lib/supabase/repositories/research/shortlist', () => ({
  getOpenEntry: track('getOpenEntry', getOpenEntry),
  openShortlistEntry: track('openShortlistEntry', openShortlistEntry),
  closeShortlistEntry: track('closeShortlistEntry', closeShortlistEntry),
  readScoreCapture: track('readScoreCapture', readScoreCapture),
  recordConfirmation: track('recordConfirmation', recordConfirmation),
  getLiveConfirmation: track('getLiveConfirmation', getLiveConfirmation),
  archiveConfirmation: track('archiveConfirmation', archiveConfirmation),
}))

vi.mock('@/lib/logging/activity', () => ({ logActivity }))

/** The reads an action makes before it writes. The write-order claim is about the writes. */
const READS = new Set([
  'getResearchProduct',
  'getOpenEntry',
  'getLiveConfirmation',
  'readScoreCapture',
  'latestStandingAction',
])
const writes = () => calls.filter((call) => !READS.has(call.name)).map((call) => call.name)

const {
  DECIDING_ACTIONS,
  REVIEW_ACTIONS,
  ReviewActionError,
  confirmProduct,
  addProductNote,
  ignoreChange,
  markDuplicate,
  recordComparison,
  rejectProduct,
  reviewChange,
  shortlistProduct,
  undoAction,
} = await import('@/lib/scraper/workflows/review-actions')

const SESSION = { label: 'session' } as never
const ADMIN = { label: 'admin' } as never

const actor = { userId: 'user-1', role: 'merchandiser' } as const
const input = { productId: 'p1', changeId: 'c1', reason: null, actor }

beforeEach(() => {
  calls.length = 0
  vi.clearAllMocks()
  getResearchProduct.mockResolvedValue({ id: 'p1', stage: 'MATCHED' })
})

describe('the nine actions', () => {
  it('are the nine the migration admits', () => {
    // `research_review_actions_action_allowlist` in 0270 is this list. A tenth action here with no
    // row-level allowance fails at the database with a constraint name; a missing one is a control
    // nobody can reach.
    expect([...REVIEW_ACTIONS]).toEqual([
      'REVIEW',
      'IGNORE',
      'SHORTLIST',
      'REJECT',
      'MARK_DUPLICATE',
      'CONFIRM',
      'NOTE',
      'TAG',
      'COMPARE',
    ])
  })

  it('treats six of them as decisions and three as activity', () => {
    expect([...DECIDING_ACTIONS]).toEqual([
      'REVIEW',
      'IGNORE',
      'SHORTLIST',
      'REJECT',
      'MARK_DUPLICATE',
      'CONFIRM',
    ])
    for (const action of ['NOTE', 'TAG', 'COMPARE'] as const) {
      expect(DECIDING_ACTIONS).not.toContain(action)
    }
  })
})

describe('the write order', () => {
  it('records the action before the effect and stamps the decision last', async () => {
    await shortlistProduct(SESSION, ADMIN, input)

    const order = writes()
    expect(order[0]).toBe('recordAction')
    expect(order.indexOf('markDecided')).toBe(order.length - 1)
    expect(order.indexOf('moveStage')).toBeGreaterThan(order.indexOf('recordAction'))
    expect(order.indexOf('moveStage')).toBeLessThan(order.indexOf('markDecided'))
  })

  it('does not stamp a decision for a note', async () => {
    // Otherwise adding a note takes the change out of the queue, which reads as "my notes are
    // making changes disappear".
    await addProductNote(SESSION, ADMIN, { ...input, body: 'A note.' })
    expect(calls.map((call) => call.name)).not.toContain('markDecided')
  })

  it('does not stamp a decision when the action is taken on a row rather than a change', async () => {
    await shortlistProduct(SESSION, ADMIN, { ...input, changeId: null })
    expect(calls.map((call) => call.name)).not.toContain('markDecided')
  })
})

describe('which client', () => {
  it('writes the action row as the person and the stamp as the system', async () => {
    await reviewChange(SESSION, ADMIN, input)

    const action = calls.find((call) => call.name === 'recordAction')
    const stamp = calls.find((call) => call.name === 'markDecided')
    expect(action?.client).toBe('session')
    expect(stamp?.client).toBe('admin')
  })

  it('writes a note as the person and supersedes as the system', async () => {
    // The note table has an insert policy and no update policy: a person may write one and nobody
    // may rewrite one, so the supersede link is the system's to set.
    await addProductNote(SESSION, ADMIN, {
      ...input,
      body: 'A newer note.',
      supersedesNoteId: 'note-0',
    })
    expect(calls.find((call) => call.name === 'addNote')?.client).toBe('session')
    expect(calls.find((call) => call.name === 'supersedeNote')?.client).toBe('admin')
  })

  it('moves a stage and sets a disposition as the system', async () => {
    await rejectProduct(SESSION, ADMIN, { ...input, reason: 'Not our market.' })
    expect(calls.find((call) => call.name === 'setDisposition')?.client).toBe('admin')
  })
})

describe('the rules each action carries', () => {
  it('refuses REJECT and IGNORE without a reason', async () => {
    await expect(rejectProduct(SESSION, ADMIN, input)).rejects.toBeInstanceOf(ReviewActionError)
    await expect(ignoreChange(SESSION, ADMIN, input)).rejects.toBeInstanceOf(ReviewActionError)
    await expect(ignoreChange(SESSION, ADMIN, { ...input, reason: '   ' })).rejects.toBeInstanceOf(
      ReviewActionError,
    )
  })

  it('accepts the other six without one', async () => {
    await expect(reviewChange(SESSION, ADMIN, input)).resolves.toBeDefined()
    await expect(shortlistProduct(SESSION, ADMIN, input)).resolves.toBeDefined()
  })

  it('refuses CONFIRM without a decision note, and confirms only a shortlisted row (Phase 35)', async () => {
    getResearchProduct.mockResolvedValue({ id: 'p1', stage: 'SHORTLISTED' })
    await expect(confirmProduct(SESSION, ADMIN, input)).rejects.toBeInstanceOf(ReviewActionError)
    await expect(
      confirmProduct(SESSION, ADMIN, { ...input, reason: 'A reference for the console family.' }),
    ).resolves.toBeDefined()
    // The decision record is written as the PERSON, after the stage moved, and the entry closes.
    const names = writes()
    expect(names.indexOf('moveStage')).toBeLessThan(names.indexOf('recordConfirmation'))
    expect(calls.find((call) => call.name === 'recordConfirmation')?.client).toBe('session')
    expect(names).toContain('closeShortlistEntry')

    getResearchProduct.mockResolvedValue({ id: 'p1', stage: 'REVIEW' })
    await expect(
      confirmProduct(SESSION, ADMIN, { ...input, reason: 'too early' }),
    ).rejects.toBeInstanceOf(ReviewActionError)
  })

  it('opens a shortlist entry as the person when the row lands on the shortlist (Phase 35)', async () => {
    await shortlistProduct(SESSION, ADMIN, { ...input, reason: 'Right scale for the atrium.' })
    // The stage mock leaves the row at MATCHED, so no entry opens; move it and it does.
    getResearchProduct.mockResolvedValue({ id: 'p1', stage: 'SHORTLISTED' })
    calls.length = 0
    await shortlistProduct(SESSION, ADMIN, { ...input, reason: 'Right scale for the atrium.' })
    expect(calls.find((call) => call.name === 'openShortlistEntry')?.client).toBe('session')
    expect(openShortlistEntry).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ reason: 'Right scale for the atrium.' }),
    )
  })

  it('refuses a row that is its own duplicate', async () => {
    await expect(
      markDuplicate(SESSION, ADMIN, { ...input, survivingProductId: 'p1' }),
    ).rejects.toBeInstanceOf(ReviewActionError)
  })

  it('refuses a comparison of more than four rows', async () => {
    await expect(
      recordComparison(SESSION, ADMIN, { ...input, againstProductIds: ['a', 'b', 'c', 'd'] }),
    ).rejects.toBeInstanceOf(ReviewActionError)
    await expect(
      recordComparison(SESSION, ADMIN, { ...input, againstProductIds: ['a', 'b', 'c'] }),
    ).resolves.toBeDefined()
  })

  it('records an event and nothing else for a comparison', async () => {
    await recordComparison(SESSION, ADMIN, { ...input, againstProductIds: ['a'] })
    const names = calls.map((call) => call.name)
    expect(names).toContain('recordEventAtCurrentStage')
    expect(names).not.toContain('moveStage')
    expect(names).not.toContain('setDisposition')
    expect(names).not.toContain('setDuplicateOf')
    expect(names).not.toContain('markDecided')
  })

  it('writes the comparison row as the system, unlike the other eight', async () => {
    // STUDIO_GUIDE.md §12.6: comparing needs only `research.read`, so a researcher must be able to
    // do it — and `research_review_actions` is `research.confirm` at the table, correctly, because
    // every other row there is a verdict. Comparing is an observation, so the system records it.
    await recordComparison(SESSION, ADMIN, { ...input, againstProductIds: ['a'] })
    expect(calls.find((call) => call.name === 'recordAction')?.client).toBe('admin')
  })

  it('does not move a stage that is already at the target', async () => {
    // "moves MATCHED to REVIEW if it was lower": acknowledging a new change on a row somebody
    // shortlisted last week must not un-shortlist it.
    getResearchProduct.mockResolvedValue({ id: 'p1', stage: 'SHORTLISTED' })
    await shortlistProduct(SESSION, ADMIN, input)
    expect(calls.map((call) => call.name)).not.toContain('moveStage')
    expect(calls.map((call) => call.name)).toContain('recordEventAtCurrentStage')
  })
})

describe('undo', () => {
  it('writes a new row and recomputes the stamp from the log', async () => {
    await undoAction(SESSION, ADMIN, {
      actionId: 'action-0',
      productId: 'p1',
      changeId: 'c1',
      reason: 'wrong row',
      actor,
    })

    const names = calls.map((call) => call.name)
    expect(names[0]).toBe('recordAction')
    expect(names).toContain('markUndone')
    // RECOMPUTED, NOT CLEARED: undoing a shortlist does not always return a change to undecided,
    // because somebody may have reviewed it first and that judgement still stands.
    expect(names).toContain('latestStandingAction')
    expect(markDecided).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: null }),
    )
  })
})
