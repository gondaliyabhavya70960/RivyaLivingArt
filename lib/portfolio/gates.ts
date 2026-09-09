/**
 * What stands between a project or a testimonial and publication, computed before anyone tries.
 *
 * WHY THIS EXISTS AT ALL, GIVEN THE TRIGGERS ALREADY REFUSE. `enforce_project_evidence_gate` and
 * `enforce_testimonial_evidence_gate` are the enforcement and cannot be bypassed — but a raised
 * exception is a bad interface. An editor who presses Publish and gets "that change could not be
 * saved" learns nothing they can act on; the useful sentence is "this project names a client and
 * their consent is still PENDING", said BEFORE the button is pressed, next to the field that fixes
 * it. That is what `OwnerVerificationPanel` renders and what this module computes.
 *
 * IT IS A MIRROR, AND A MIRROR CAN DRIFT. This logic and the trigger bodies are written twice, in
 * two languages, and nothing in the type system ties them together. `tests/unit/rls/phase17.test.ts`
 * therefore checks them against each other: for a set of rows it asks this function whether publish
 * should be allowed, then asks the DATABASE to publish the same row, and requires the two answers
 * to agree. A mirror that is tested against the thing it mirrors is a mirror that stays true.
 *
 * PURE, AND DELIBERATELY SO. No client, no session, no environment — a row in, a list of gates out.
 * That is what lets the agreement test above exercise it exhaustively without a database, and what
 * lets the panel be rendered in a test with a plain object.
 */

/** The reason a row cannot be published, in the vocabulary the Studio strings are keyed by. */
export type GateId =
  'owner_verification' | 'client_consent' | 'consent_withdrawn' | 'attribution_consent'

export type PublishGate = {
  readonly id: GateId
  /** True when this gate is satisfied. An unmet gate is what the panel lists. */
  readonly met: boolean
  /**
   * Whether an owner or admin is required to clear it, as opposed to any editor.
   *
   * THE PANEL SAYS SO OUT LOUD, because "you cannot publish this" and "you cannot publish this and
   * you are not the person who can fix it" are different messages, and only the second one tells an
   * editor to go and ask somebody.
   */
  readonly ownerOnly: boolean
}

/** The shape the project gate reads. A subset of the row, so a partial draft can be checked. */
export type ProjectGateInput = {
  readonly owner_verification: string
  readonly client_display_name: string | null
  readonly client_consent: string
}

/** The shape the testimonial gate reads. */
export type TestimonialGateInput = {
  readonly owner_verification: string
  readonly attributed_to: string | null
  readonly consent: string
}

/**
 * The gates on publishing a project, in the order the panel lists them.
 *
 * `consent_withdrawn` IS A GATE OF ITS OWN rather than a failure of `client_consent`, because the
 * two need different sentences. A PENDING consent is something an editor chases; a WITHDRAWN one is
 * a decision somebody made, and the row is on its way to ARCHIVED whatever anyone does next. The
 * trigger encodes the same distinction by handling withdrawal FIRST and unconditionally.
 */
export function projectPublishGates(project: ProjectGateInput): readonly PublishGate[] {
  const names = project.client_display_name !== null
  return [
    { id: 'owner_verification', met: project.owner_verification === 'VERIFIED', ownerOnly: true },
    {
      id: 'consent_withdrawn',
      met: project.client_consent !== 'WITHDRAWN',
      ownerOnly: false,
    },
    {
      // Only a project that NAMES someone needs consent. One that names nobody is not gated on it,
      // and listing a satisfied gate it never had would be noise.
      id: 'client_consent',
      met: !names || project.client_consent === 'GRANTED',
      ownerOnly: true,
    },
  ]
}

/** The same two questions over a testimonial's own columns. */
export function testimonialPublishGates(testimonial: TestimonialGateInput): readonly PublishGate[] {
  const names = testimonial.attributed_to !== null
  return [
    {
      id: 'owner_verification',
      met: testimonial.owner_verification === 'VERIFIED',
      ownerOnly: true,
    },
    { id: 'consent_withdrawn', met: testimonial.consent !== 'WITHDRAWN', ownerOnly: false },
    {
      id: 'attribution_consent',
      met: !names || testimonial.consent === 'GRANTED',
      ownerOnly: true,
    },
  ]
}

/** Whether every gate is satisfied. The panel shows the unmet ones; this decides the button. */
export function canPublish(gates: readonly PublishGate[]): boolean {
  return gates.every((gate) => gate.met)
}

/** Just the blockers, for a panel that lists reasons rather than a checklist of everything. */
export function unmetGates(gates: readonly PublishGate[]): readonly PublishGate[] {
  return gates.filter((gate) => !gate.met)
}
